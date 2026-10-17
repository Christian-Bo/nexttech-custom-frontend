import type { HttpClient } from '~/types/api'
import type { NotificationCode } from '~/features/profile/services/profileService'
import { useApi } from '~/services/api'

/**
 * Credencial digital del comprador (PDF con retrato + QR nuevo).
 * Requiere enrolamiento facial. Invalida el QR anterior. Límite: 3 cada 10 min.
 */
export function createCredentialService(api: HttpClient) {
  return {
    issue: () =>
      api<Blob>('/api/credential/issue', { method: 'POST', responseType: 'blob', timeout: 45_000 }),

    /** Solicita una nueva credencial y revoca el QR anterior (nunca invocar automáticamente). */
    reissue: (channel: NotificationCode) =>
      api<Blob>('/api/credential/reissue', {
        method: 'POST',
        body: { channel },
        responseType: 'blob',
        timeout: 60_000
      })
  }
}

/** Descarga un Blob como archivo y libera la URL. No guardar el PDF en ningún lado público. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function useCredentialService() {
  return createCredentialService(useApi())
}
