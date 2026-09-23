import { describe, expect, it } from 'vitest'
import { decodeJwt } from '~/utils/jwt'

function fakeToken(payload: Record<string, unknown>): string {
  const bytes = new TextEncoder().encode(JSON.stringify(payload))
  const b64 = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `header.${b64}.firma`
}

describe('decodeJwt (unitaria)', () => {
  it('lee los claims del comprador', () => {
    const claims = decodeJwt(fakeToken({ actor_type: 'BUYER', buyer_id: '42', nickname: 'Sergio' }))
    expect(claims).toMatchObject({ actor_type: 'BUYER', buyer_id: '42', nickname: 'Sergio' })
  })

  it('soporta acentos y ñ (UTF-8)', () => {
    expect(decodeJwt(fakeToken({ nickname: 'Peña Ágil' }))?.nickname).toBe('Peña Ágil')
  })

  it('copia el rol largo de .NET a "role"', () => {
    const claims = decodeJwt(fakeToken({ 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role': 'SUPERVISOR' }))
    expect(claims?.role).toBe('SUPERVISOR')
  })

  it.each(['', 'sin-puntos', 'a.%%%.c'])('devuelve null con un token inválido (%s)', (token) => {
    expect(decodeJwt(token)).toBeNull()
  })
})
