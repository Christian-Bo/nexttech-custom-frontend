import { useApi } from '~/services/api'
import type { ApiError, HttpClient } from '~/types/api'
import type { AccessTokenResultDto } from '~/types/auth'

/** Perfil del comprador. Contrato: BuyerProfileController (/api/profile). */

export type NotificationCode = 'EMAIL' | 'WHATSAPP' | 'EMAIL_AND_WHATSAPP'

export interface NotificationOption {
  code: NotificationCode
  name: string
}

export interface BuyerProfile {
  buyerId: number
  email: string
  phone: string
  birthDate: string | null
  nickname: string
  role: { code: string, name: string }
  notificationPreference: NotificationOption
  account: { isActive: boolean, isBlocked: boolean, canAuthenticate: boolean }
  photo: { hasOriginalPhoto: boolean, hasDisplayPhoto: boolean }
  lastAccessUtc: string | null
  createdAtUtc: string
  updatedAtUtc: string
}

export interface UpdateProfileRequest {
  phone: string
  nickname: string
  birthDate: string | null
  notificationPreferenceCode: NotificationCode
}

export interface ProfileMutationResult {
  profile: BuyerProfile
  refreshedToken: AccessTokenResultDto
}

export interface ProfileService {
  get: () => Promise<BuyerProfile>
  update: (req: UpdateProfileRequest) => Promise<ProfileMutationResult>
  changePassword: (currentPassword: string, newPassword: string) => Promise<ProfileMutationResult>
  /** Foto para mostrar (la modificada si existe). null si no tiene foto. */
  photo: () => Promise<Blob | null>
}

export const NOTIFICATION_OPTIONS: NotificationOption[] = [
  { code: 'EMAIL', name: 'Correo electrónico' },
  { code: 'WHATSAPP', name: 'WhatsApp' },
  { code: 'EMAIL_AND_WHATSAPP', name: 'Correo electrónico y WhatsApp' }
]

const MOCK_KEY = 'nt-mock-profile'

function mockProfile(): BuyerProfile {
  const now = new Date().toISOString()
  const base: BuyerProfile = {
    buyerId: 1001,
    email: 'comprador.demo@miumg.edu.gt',
    phone: '5555-1234',
    birthDate: '2003-05-14',
    nickname: 'comprador_demo',
    role: { code: 'COMPRADOR', name: 'Comprador' },
    notificationPreference: NOTIFICATION_OPTIONS[0]!,
    account: { isActive: true, isBlocked: false, canAuthenticate: true },
    photo: { hasOriginalPhoto: false, hasDisplayPhoto: false },
    lastAccessUtc: now,
    createdAtUtc: '2026-09-01T15:00:00Z',
    updatedAtUtc: now
  }
  try {
    const saved = localStorage.getItem(MOCK_KEY)
    return saved ? { ...base, ...(JSON.parse(saved) as Partial<BuyerProfile>) } : base
  }
  catch {
    return base
  }
}

function fakeToken(): AccessTokenResultDto {
  return { accessToken: '', expiresAtUtc: new Date(Date.now() + 3_600_000).toISOString(), actorType: 'buyer', mustChangePassword: false }
}

export function createMockProfileService(): ProfileService {
  return {
    async get() {
      await new Promise(r => setTimeout(r, 250))
      return mockProfile()
    },
    async update(req) {
      await new Promise(r => setTimeout(r, 400))
      const next: BuyerProfile = {
        ...mockProfile(),
        phone: req.phone.trim(),
        nickname: req.nickname.trim(),
        birthDate: req.birthDate,
        notificationPreference: NOTIFICATION_OPTIONS.find(o => o.code === req.notificationPreferenceCode) ?? NOTIFICATION_OPTIONS[0]!,
        updatedAtUtc: new Date().toISOString()
      }
      try {
        localStorage.setItem(MOCK_KEY, JSON.stringify(next))
      }
      catch {
        // opcional
      }
      return { profile: next, refreshedToken: fakeToken() }
    },
    async changePassword(current, next) {
      await new Promise(r => setTimeout(r, 400))
      if (current === next) throw { status: 400, code: 'BAD_REQUEST', message: 'La nueva contraseña debe ser distinta a la actual.' } satisfies ApiError
      return { profile: mockProfile(), refreshedToken: fakeToken() }
    },
    async photo() {
      return null
    }
  }
}

export function createHttpProfileService(api: HttpClient): ProfileService {
  return {
    get: () => api<BuyerProfile>('/api/profile/me'),
    update: req => api<ProfileMutationResult>('/api/profile/me', {
      method: 'PUT',
      body: { phone: req.phone.trim(), nickname: req.nickname.trim(), birthDate: req.birthDate || null, notificationPreferenceCode: req.notificationPreferenceCode }
    }),
    changePassword: (currentPassword, newPassword) => api<ProfileMutationResult>('/api/profile/change-password', {
      method: 'POST',
      body: { currentPassword, newPassword }
    }),
    async photo() {
      try {
        return await api<Blob>('/api/profile/photo', { responseType: 'blob' })
      }
      catch (e) {
        if ((e as ApiError).status === 404) return null
        throw e
      }
    }
  }
}

export function useProfileService(): ProfileService {
  return useRuntimeConfig().public.useMocks ? createMockProfileService() : createHttpProfileService(useApi())
}
