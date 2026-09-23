import { describe, expect, it } from 'vitest'
import { isApiError, normalizeApiError } from '~/services/api/errors'

/** Caja blanca: una prueba por cada rama de normalizeApiError. */
describe('normalizeApiError (caja blanca)', () => {
  it('rama: ya es ApiError -> se devuelve igual', () => {
    const e = { status: 404, code: 'NOT_FOUND', message: 'x' }
    expect(normalizeApiError(e)).toBe(e)
  })

  it('rama: status 0 + timeout', () => {
    expect(normalizeApiError({ name: 'TimeoutError' }).code).toBe('TIMEOUT')
    expect(normalizeApiError({ message: 'Request timeout' }).code).toBe('TIMEOUT')
  })

  it('rama: status 0 + abort', () => {
    expect(normalizeApiError({ cause: { name: 'AbortError' } }).code).toBe('ABORTED')
  })

  it('rama: status 0 sin causa -> error de red', () => {
    const e = normalizeApiError(new Error('fail'))
    expect(e).toMatchObject({ status: 0, code: 'NETWORK_ERROR' })
  })

  it('rama: valor que no es objeto', () => {
    expect(normalizeApiError('boom').code).toBe('NETWORK_ERROR')
  })

  it('rama: 5xx nunca muestra el detalle del backend (OWASP)', () => {
    const e = normalizeApiError({ statusCode: 500, data: { detail: 'NullReferenceException at Foo.cs:12' } })
    expect(e.message).not.toContain('Exception')
    expect(e.message).toMatch(/servidor/i)
  })

  it('rama: 503 usa su mensaje amigable', () => {
    expect(normalizeApiError({ status: 503 }).message).toMatch(/no está disponible/)
  })

  it('rama: 4xx con errores de validación -> primer mensaje', () => {
    const e = normalizeApiError({ statusCode: 400, data: { errors: { Email: ['El correo ya existe.'] } } })
    expect(e.message).toBe('El correo ya existe.')
    expect(e.details).toEqual({ Email: ['El correo ya existe.'] })
  })

  it('rama: 4xx con detail -> se muestra el detail', () => {
    expect(normalizeApiError({ statusCode: 409, data: { detail: 'Ya tomado.' } }).message).toBe('Ya tomado.')
  })

  it('rama: 4xx sin detail -> mensaje amigable por código', () => {
    expect(normalizeApiError({ statusCode: 403, data: {} }).message).toMatch(/permiso/)
  })

  it('rama: código desconocido -> HTTP_<status> y mensaje genérico', () => {
    const e = normalizeApiError({ statusCode: 418 })
    expect(e.code).toBe('HTTP_418')
    expect(e.message).toBe('No se pudo completar la solicitud.')
  })

  it('rama: title con formato de código del backend se usa como code', () => {
    expect(normalizeApiError({ statusCode: 409, data: { title: 'AppConflictException', traceId: 't-1' } }))
      .toMatchObject({ code: 'AppConflictException', traceId: 't-1' })
  })

  it('isApiError distingue objetos válidos', () => {
    expect(isApiError({ status: 1, code: 'A', message: 'b' })).toBe(true)
    expect(isApiError({ status: '1' })).toBe(false)
    expect(isApiError(null)).toBe(false)
  })
})
