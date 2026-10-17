import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const card = readFileSync(new URL('../../components/credential/VisualCredentialEditor.vue', import.meta.url), 'utf8')
const page = readFileSync(new URL('../../pages/mi-credencial.vue', import.meta.url), 'utf8')
const account = readFileSync(new URL('../../pages/mi-cuenta.vue', import.meta.url), 'utf8')
const pdf = readFileSync(new URL('../../utils/visualCredentialPdf.ts', import.meta.url), 'utf8')
const credentialService = readFileSync(new URL('../../services/credentialService.ts', import.meta.url), 'utf8')

describe('Una sola credencial visual con QR auténtico del backend', () => {
  it('obtiene la foto del backend y evita confirmación V4 rechazada por Oracle', () => {
    expect(page).toContain('await profile.photo()')
    expect(page).toContain('await authService.rotateQr()')
    expect(page).not.toContain('service.confirm(')
    expect(page).not.toContain('service.saveCustomization(')
    expect(page).not.toContain('Opciones de emisión y PDF')
  })
  it('solo rota el QR tras una confirmación explícita y no altera las preferencias visuales', () => {
    expect(page).toContain('if (!accepted) return')
    expect(page).toContain("confirmText: 'Activar y descargar'")
    expect(page).toContain('activeQrCredential.value = result.qrCredential')
    expect(card).toContain("emit('activateCredential')")
    expect(card).toContain("emit('downloadCredential')")
    expect(card).not.toContain('loadOfficialQrImage')
  })
  it('no persiste el QR en el almacenamiento del navegador', () => {
    expect(page).not.toContain('sessionStorage.')
    expect(page).not.toContain('localStorage.')
    expect(page).toContain("activeQrCredential.value = ''")
    expect(card).not.toContain('localStorage.')
  })
  it('descarga un PDF con el QR del backend, colores y stickers visuales', () => {
    expect(pdf).toContain("import('qrcode')")
    expect(pdf).toContain('data.qrCredential')
    expect(pdf).toContain('data.design.stickers')
    expect(pdf).toContain('doc.output(')
  })
  it('sigue ocultando la reemisión del perfil', () => {
    expect(account).not.toContain('CredentialReissueCard')
    expect(account).toContain('FaceEnrollCard')
  })
  it('envía el PDF visual a la API existente sin volver a rotar el QR', () => {
    expect(page).toContain('service.sendPersonalized(pdf, activeQrCredential.value)')
    expect(page).toContain('await downloadCurrentPdf()')
    expect(page).toContain('Reintentar envío')
    expect(credentialService).toContain("'/api/credential/send-personalized'")
    expect(credentialService).toContain("form.append('pdf', pdf")
    expect(credentialService).toContain("form.append('qrCredential', qrCredential)")
  })

})
