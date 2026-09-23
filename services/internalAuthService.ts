import type { HttpClient } from '~/types/api'
import type { AccessTokenResultDto, InternalLoginRequestDto } from '~/types/auth'
import { useApi } from '~/services/api'

/** Acceso del personal interno: ADMIN, SUPERVISOR, REPARTIDOR (/api/internal/auth). */
export function createInternalAuthService(api: HttpClient) {
  return {
    /** 5 intentos fallidos => bloqueo de 15 min (lo decide el backend). */
    login: (body: InternalLoginRequestDto) =>
      api<AccessTokenResultDto>('/api/internal/auth/login', { method: 'POST', body: { ...body } }),

    /** 204. Nueva contraseña: 8-128, mayúscula, minúscula y número. */
    changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
      await api('/api/internal/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } })
    }
  }
}

export function useInternalAuthService() {
  return createInternalAuthService(useApi())
}
