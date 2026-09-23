import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHttpClient } from '~/services/api/httpClient'

/**
 * Caja negra del cliente HTTP: se observa solo lo que entra ($fetch simulado) y lo que sale
 * (respuesta, error normalizado y aviso de sesión vencida).
 */
describe('Cliente HTTP (caja negra)', () => {
  const fetchMock = vi.fn()
  const onUnauthorized = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('$fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    fetchMock.mockReset()
    onUnauthorized.mockReset()
  })

  function client(token: string | null) {
    return createHttpClient({ baseURL: 'http://api.test', getToken: () => token, onUnauthorized })
  }

  it('envía el JWT como Bearer cuando hay sesión', async () => {
    fetchMock.mockResolvedValue({ ok: true })
    await client('abc.def.ghi')('/api/cart')
    const [, options] = fetchMock.mock.calls[0]!
    expect(options.headers.Authorization).toBe('Bearer abc.def.ghi')
    expect(options.baseURL).toBe('http://api.test')
  })

  it('no envía Authorization sin sesión', async () => {
    fetchMock.mockResolvedValue({})
    await client(null)('/api/catalog/products')
    expect(fetchMock.mock.calls[0]![1].headers.Authorization).toBeUndefined()
  })

  it('devuelve la respuesta tal cual', async () => {
    fetchMock.mockResolvedValue({ codigoOrden: 'ORD-1' })
    await expect(client(null)('/x')).resolves.toEqual({ codigoOrden: 'ORD-1' })
  })

  it('401 con sesión -> cierra sesión y lanza ApiError', async () => {
    fetchMock.mockRejectedValue({ statusCode: 401, data: {} })
    await expect(client('t')('/api/cart')).rejects.toMatchObject({ status: 401, code: 'UNAUTHORIZED' })
    expect(onUnauthorized).toHaveBeenCalledOnce()
  })

  it('401 sin sesión (login fallido) -> NO cierra sesión', async () => {
    fetchMock.mockRejectedValue({ statusCode: 401, data: { detail: 'Credenciales inválidas.' } })
    await expect(client(null)('/api/auth/login')).rejects.toMatchObject({ message: 'Credenciales inválidas.' })
    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it('500 -> mensaje genérico, sin filtrar detalles internos', async () => {
    fetchMock.mockRejectedValue({ statusCode: 500, data: { detail: 'ORA-01017: invalid username/password' } })
    const error = await client('t')('/x').catch((e: unknown) => e as { message: string })
    expect((error as { message: string }).message).not.toContain('ORA-')
  })

  it('error de una descarga (Blob) se lee como ProblemDetails', async () => {
    const blob = new Blob([JSON.stringify({ detail: 'Primero registra tu rostro.' })], { type: 'application/problem+json' })
    fetchMock.mockRejectedValue({ statusCode: 409, data: blob })
    await expect(client('t')('/api/credential/issue', { responseType: 'blob' }))
      .rejects.toMatchObject({ status: 409, message: 'Primero registra tu rostro.' })
  })
})
