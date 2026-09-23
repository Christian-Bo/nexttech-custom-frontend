import type { HttpClient } from '~/types/api'
import type {
  AccessTokenResultDto,
  BuyerRegisterRequestDto,
  BuyerRegistrationResultDto,
  FaceCaptureDto,
  FaceChallengeDto,
  ForgotPasswordRequestDto,
  ForgotPasswordResultDto,
  LoginRequestDto,
  QrRotateResultDto,
  ResetPasswordRequestDto
} from '~/types/auth'
import { useApi } from '~/services/api'

/** Endpoints de acceso del comprador (/api/auth). Contrato: kit Postman del Integrante 2. */
export function createAuthService(api: HttpClient) {
  return {
    register: (body: BuyerRegisterRequestDto) =>
      api<BuyerRegistrationResultDto>('/api/auth/register', { method: 'POST', body: { ...body } }),

    login: (body: LoginRequestDto) =>
      api<AccessTokenResultDto>('/api/auth/login', { method: 'POST', body: { ...body } }),

    /** El contenido escaneado del QR se envía tal cual. Nunca registrarlo en logs. */
    qrLogin: (qrCredential: string) =>
      api<AccessTokenResultDto>('/api/auth/qr-login', { method: 'POST', body: { qrCredential } }),

    /** Invalida el QR anterior. Advertir al usuario antes de llamar. */
    rotateQr: () =>
      api<QrRotateResultDto>('/api/auth/qr/rotate', { method: 'POST' }),

    forgotPassword: (body: ForgotPasswordRequestDto) =>
      api<ForgotPasswordResultDto>('/api/auth/forgot-password', { method: 'POST', body: { ...body } }),

    resetPassword: (body: ResetPasswordRequestDto) =>
      api<void>('/api/auth/reset-password', { method: 'POST', body: { ...body } }),

    /** Reto facial público (login sin JWT). */
    faceChallenge: () =>
      api<FaceChallengeDto>('/api/auth/face-challenge', { method: 'POST' }),

    /** Login facial. Ante 401 mostrar SIEMPRE un mensaje genérico. */
    faceLogin: (identifier: string, challengeId: string, capture: FaceCaptureDto) => {
      const form = new FormData()
      form.append('identifier', identifier)
      form.append('challengeId', challengeId)
      form.append('neutralImage', capture.neutralImage, 'neutral.jpg')
      form.append('challengeImage', capture.challengeImage, 'challenge.jpg')
      return api<AccessTokenResultDto>('/api/auth/face-login', { method: 'POST', body: form, timeout: 45_000 })
    }
  }
}

export type AuthService = ReturnType<typeof createAuthService>

/** Llamar en setup (necesita contexto Nuxt). */
export function useAuthService(): AuthService {
  return createAuthService(useApi())
}
