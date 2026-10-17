
import { describe, expect, it, vi } from 'vitest'
import { createNotificationService } from '~/services/notificationService'
import { createCredentialService } from '~/services/credentialService'
import type { HttpClient } from '~/types/api'

describe('Contratos de notificaciones y credenciales', () => {
  it('reenviar bienvenida usa JWT del cliente y solo manda el canal', async () => {
    const api = vi.fn().mockResolvedValue({ channel: 'WHATSAPP', message: 'Procesada' }) as unknown as HttpClient
    await createNotificationService(api).resendWelcome('WHATSAPP')
    expect(api).toHaveBeenCalledWith('/api/notifications/welcome/resend', {
      method: 'POST', body: { channel: 'WHATSAPP' }
    })
  })

  it('reissue solicita PDF usando POST y el canal seleccionado, sin datos personales', async () => {
    const pdf = new Blob(['%PDF-1.7'], { type: 'application/pdf' })
    const api = vi.fn().mockResolvedValue(pdf) as unknown as HttpClient
    await expect(createCredentialService(api).reissue('EMAIL_AND_WHATSAPP')).resolves.toBe(pdf)
    expect(api).toHaveBeenCalledWith('/api/credential/reissue', {
      method: 'POST', body: { channel: 'EMAIL_AND_WHATSAPP' }, responseType: 'blob', timeout: 60_000
    })
  })

  it('la emisión anterior no se reemplaza ni cambia de contrato', async () => {
    const api = vi.fn().mockResolvedValue(new Blob(['%PDF-1.7'])) as unknown as HttpClient
    await createCredentialService(api).issue()
    expect(api).toHaveBeenCalledWith('/api/credential/issue', {
      method: 'POST', responseType: 'blob', timeout: 45_000
    })
  })
})
