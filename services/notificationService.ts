import type { NotificationCode } from '~/features/profile/services/profileService'
import type { HttpClient } from '~/types/api'
import { useApi } from '~/services/api'

/** Respuesta 202 Accepted de POST /api/notifications/welcome/resend. */
export interface WelcomeResendResult {
  channel: NotificationCode
  message: string
}

/** Usa al comprador del JWT: nunca envía correo, teléfono ni nickname. */
export function createNotificationService(api: HttpClient) {
  return {
    resendWelcome: (channel: NotificationCode) =>
      api<WelcomeResendResult>('/api/notifications/welcome/resend', {
        method: 'POST',
        body: { channel }
      })
  }
}

export function useNotificationService() {
  return createNotificationService(useApi())
}
