import type { AccessTokenResultDto, BuyerRegisterRequestDto, BuyerRegistrationResultDto } from '~/types/auth'
import { useApi } from '~/services/api'

/**
 * Llamadas de autenticación del COMPRADOR.
 * Rutas verificadas contra el backend (AuthController).
 * Los errores ya llegan normalizados como ApiError desde el cliente HTTP.
 */
export function useAuthService() {
  const api = useApi()

  return {
    /** Crea la cuenta del comprador. Devuelve el id, la credencial QR y el token. */
    register(payload: BuyerRegisterRequestDto) {
      return api<BuyerRegistrationResultDto>('/api/auth/register', {
        method: 'POST',
        body: {
          email: payload.email,
          phone: payload.phone,
          nickname: payload.nickname,
          password: payload.password,
          birthDate: payload.birthDate ?? null,
          notifyByEmail: payload.notifyByEmail,
          notifyByWhatsApp: payload.notifyByWhatsApp
        }
      })
    },

    /** identifier = correo o nickname. */
    login(identifier: string, password: string) {
      return api<AccessTokenResultDto>('/api/auth/login', {
        method: 'POST',
        body: { identifier, password }
      })
    },

    /** Login con el QR de la credencial. */
    loginWithQr(qrCredential: string) {
      return api<AccessTokenResultDto>('/api/auth/qr-login', {
        method: 'POST',
        body: { qrCredential }
      })
    },

    /** Envía el enlace de recuperación al correo registrado. */
    async forgotPassword(email: string): Promise<void> {
      await api('/api/auth/forgot-password', {
        method: 'POST',
        body: { email }
      })
    },

    /** Cambia la contraseña con el token que llega por correo. */
    async resetPassword(token: string, newPassword: string): Promise<void> {
      await api('/api/auth/reset-password', {
        method: 'POST',
        body: { token, newPassword }
      })
    }
  }
}