import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

// El SMTP puede emitir /reset-password y el frontend mantiene su ruta antigua.
describe('Enlace de recuperación del backend V4', () => {
  it('acepta /reset-password sin perder la ruta /restablecer-contrasena', () => {
    const page = readFileSync(new URL('../../pages/restablecer-contrasena.vue', import.meta.url), 'utf8')
    expect(page).toContain("alias: ['/reset-password']")
    expect(page).toContain("typeof route.query.token === 'string'")
    expect(page).toContain("authService.resetPassword({ token: token.value, newPassword: password.value })")
  })
})
