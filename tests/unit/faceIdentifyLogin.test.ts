import { describe, expect, it, vi } from 'vitest'
import { createAuthService } from '~/services/authService'
import type { HttpClient } from '~/types/api'

/**
 * Contrato del login facial rápido 1:N.
 * El endpoint cambió: antes pedía challengeId + neutralImage + challengeImage,
 * ahora recibe únicamente `image`.
 */
describe('Login facial 1:N (POST /api/auth/face-identify-login)', () => {
  function servicioEspiado() {
    const api = vi.fn().mockResolvedValue({
      accessToken: 'jwt',
      expiresAtUtc: '2026-12-31T00:00:00Z',
      actorType: 'buyer',
      mustChangePassword: false
    }) as unknown as HttpClient
    return { api, service: createAuthService(api) }
  }

  it('llama al endpoint correcto por POST', async () => {
    const { api, service } = servicioEspiado()
    await service.identifyLogin(new Blob(['x'], { type: 'image/jpeg' }))

    const [ruta, opciones] = (api as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!
    expect(ruta).toBe('/api/auth/face-identify-login')
    expect(opciones.method).toBe('POST')
  })

  it('envía FormData con un único campo: image', async () => {
    const { api, service } = servicioEspiado()
    await service.identifyLogin(new Blob(['x'], { type: 'image/jpeg' }))

    const [, opciones] = (api as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!
    const body = opciones.body as FormData
    expect(body).toBeInstanceOf(FormData)
    expect([...body.keys()]).toEqual(['image'])
  })

  it('no envía el contrato viejo de 1:1 (challengeId ni las dos imágenes)', async () => {
    const { api, service } = servicioEspiado()
    await service.identifyLogin(new Blob(['x'], { type: 'image/jpeg' }))

    const [, opciones] = (api as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!
    const campos = [...(opciones.body as FormData).keys()]
    expect(campos).not.toContain('challengeId')
    expect(campos).not.toContain('neutralImage')
    expect(campos).not.toContain('challengeImage')
    expect(campos).not.toContain('identifier')
  })

  it('no fija Content-Type: lo pone el navegador con su boundary', async () => {
    const { api, service } = servicioEspiado()
    await service.identifyLogin(new Blob(['x'], { type: 'image/jpeg' }))

    const [, opciones] = (api as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!
    const headers = (opciones.headers ?? {}) as Record<string, string>
    expect(Object.keys(headers).map(k => k.toLowerCase())).not.toContain('content-type')
  })

  it('devuelve el mismo contrato de sesión que el login tradicional', async () => {
    const { service } = servicioEspiado()
    const result = await service.identifyLogin(new Blob(['x'], { type: 'image/jpeg' }))

    expect(result.actorType).toBe('buyer')
    expect(result.accessToken).toBe('jwt')
  })

  it('el login facial 1:1 con prueba de vida se conserva intacto', async () => {
    const { api, service } = servicioEspiado()
    await service.faceLogin('comprador', 'reto-1', {
      neutralImage: new Blob(['n'], { type: 'image/jpeg' }),
      challengeImage: new Blob(['c'], { type: 'image/jpeg' })
    })

    const [ruta, opciones] = (api as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!
    expect(ruta).toBe('/api/auth/face-login')
    expect([...(opciones.body as FormData).keys()].sort())
      .toEqual(['challengeId', 'challengeImage', 'identifier', 'neutralImage'])
  })
})
