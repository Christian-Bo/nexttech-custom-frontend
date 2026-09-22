import { defineStore } from 'pinia'
import { computed } from 'vue'
import type { AccessTokenResultDto, AuthSession, InternalRole } from '~/types/auth'
import { ACTOR_TYPES } from '~/types/auth'
import { decodeJwt } from '~/utils/jwt'

/**
 * Estado global de autenticación (compartido con Integrante 4).
 * La sesión vive en una cookie para que SSR y cliente la vean igual.
 * La autorización real la decide SIEMPRE el backend; esto es solo para la UI.
 */
export const useAuthStore = defineStore('auth', () => {
  const session = useCookie<AuthSession | null>('nt_session', {
    default: () => null,
    sameSite: 'strict',
    secure: !import.meta.dev,
    path: '/',
    maxAge: 60 * 60 * 12
  })

  const claims = computed(() => (session.value ? decodeJwt(session.value.accessToken) : null))

  function isExpired(): boolean {
    if (!session.value) return true
    const expiresAt = Date.parse(session.value.expiresAtUtc)
    return Number.isNaN(expiresAt) || expiresAt <= Date.now()
  }

  const isAuthenticated = computed(() => !!session.value && !isExpired())
  const accessToken = computed(() => (isAuthenticated.value ? session.value!.accessToken : null))
  const actorType = computed(() => session.value?.actorType ?? null)
  const isBuyer = computed(() => isAuthenticated.value && actorType.value === ACTOR_TYPES.BUYER)
  const isInternal = computed(() => isAuthenticated.value && actorType.value === ACTOR_TYPES.INTERNAL)
  const role = computed<InternalRole | null>(() => (isInternal.value ? claims.value?.role ?? null : null))
  const nickname = computed(() => claims.value?.nickname ?? null)
  const buyerId = computed(() => (claims.value?.buyer_id ? Number(claims.value.buyer_id) : null))
  const internalUserId = computed(() =>
    claims.value?.internal_user_id ? Number(claims.value.internal_user_id) : null
  )
  const mustChangePassword = computed(() => session.value?.mustChangePassword ?? false)

  function hasRole(...roles: InternalRole[]): boolean {
    return role.value !== null && roles.includes(role.value)
  }

  /** Guarda la sesión con la respuesta de cualquier endpoint de login. */
  function setSession(result: AccessTokenResultDto): void {
    session.value = {
      accessToken: result.accessToken,
      expiresAtUtc: result.expiresAtUtc,
      actorType: result.actorType,
      mustChangePassword: result.mustChangePassword
    }
  }

  function clearSession(): void {
    session.value = null
  }

  return {
    accessToken,
    actorType,
    isAuthenticated,
    isBuyer,
    isInternal,
    role,
    nickname,
    buyerId,
    internalUserId,
    mustChangePassword,
    hasRole,
    setSession,
    clearSession
  }
})
