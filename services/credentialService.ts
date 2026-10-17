import type { HttpClient } from '~/types/api'
import type { NotificationCode } from '~/features/profile/services/profileService'
import { useApi } from '~/services/api'

/**
 * Credencial digital del comprador (PDF con retrato + QR nuevo).
 * Requiere enrolamiento facial. Invalida el QR anterior. Límite: 3 cada 10 min.
 */
export interface CredentialStickerPlacement {
  stickerId: string
  slot: string
}
export interface CredentialDesign {
  templateId: string
  stickers: CredentialStickerPlacement[]
}
export interface CredentialContext {
  nickname: string
  role: string
  portraitEndpoint: string
  current: CredentialDesign
  templates: { id: string, name: string, description: string }[]
  stickers: { id: string, name: string }[]
  stickerSlots: string[]
}

export function createCredentialService(api: HttpClient) {
  return {
    customizationContext: () => api<CredentialContext>('/api/credential/customization-context'),
    saveCustomization: (design: CredentialDesign) => api<CredentialDesign>('/api/credential/customization', { method: 'PUT', body: { templateId: design.templateId, stickers: design.stickers } }),
    preview: (design: CredentialDesign) => api<Blob>('/api/credential/preview', { method: 'POST', body: { templateId: design.templateId, stickers: design.stickers }, responseType: 'blob', timeout: 45_000 }),
    /** Genera un QR nuevo y envía el MISMO PDF por los canales guardados del comprador. */
    confirm: (design: CredentialDesign) => api<Blob>('/api/credential/confirm', { method: 'POST', body: { templateId: design.templateId, stickers: design.stickers }, responseType: 'blob', timeout: 60_000 }),
    /** Envía por los canales habilitados el mismo PDF visual y el QR YA vigente. No rota el QR. */
    sendPersonalized: (pdf: Blob, qrCredential: string) => {
      const form = new FormData()
      form.append('pdf', pdf, 'credencial-nexttech-personalizada.pdf')
      form.append('qrCredential', qrCredential)
      return api<{ channel: string, message: string }>('/api/credential/send-personalized', {
        method: 'POST', body: form, timeout: 90_000
      })
    },
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
