import type { HttpClient, HttpRequestOptions } from '~/types/api'
import { normalizeApiError } from './errors'

/**
 * Cuando se solicita un PDF (responseType: blob), un error HTTP puede devolver
 * ProblemDetails en un Blob. Los FetchError de ofetch tienen `data` de solo
 * lectura, así que copiamos los campos en vez de modificar el error original.
 */
async function readBlobError(error: unknown): Promise<unknown> {
  if (typeof Blob === 'undefined' || !error || typeof error !== 'object') return error

  const e = error as {
    name?: string
    message?: string
    status?: number
    statusCode?: number
    cause?: unknown
    data?: unknown
  }
  if (!(e.data instanceof Blob)) return error

  let data: unknown
  try {
    data = JSON.parse(await e.data.text())
  }
  catch {
    data = undefined
  }

  // Los getters de FetchError (status/statusCode/data) no siempre son
  // enumerables; un spread por sí solo perdería el código HTTP original.
  return {
    name: e.name,
    message: e.message,
    status: e.status,
    statusCode: e.statusCode,
    cause: e.cause,
    data
  }
}

export interface HttpClientDeps {
  baseURL: string
  /** Devuelve el JWT vigente o null. */
  getToken: () => string | null
  /** Se invoca cuando una request autenticada recibe 401. */
  onUnauthorized: () => void
  /** Timeout por defecto en ms. */
  defaultTimeout?: number
}

/**
 * Crea el cliente HTTP base. TODO request al API pasa por aquí:
 * - agrega Authorization: Bearer <jwt> si hay sesión
 * - normaliza cualquier error a ApiError
 * - ante 401 con token, notifica para cerrar la sesión
 * Función pura (sin contexto Nuxt) para poder testearla.
 */
export function createHttpClient(deps: HttpClientDeps): HttpClient {
  const defaultTimeout = deps.defaultTimeout ?? 15_000

  return async <T = unknown>(path: string, options: HttpRequestOptions = {}): Promise<T> => {
    const token = deps.getToken()
    const responseType = options.responseType ?? 'json'
    const headers: Record<string, string> = {
      Accept: responseType === 'json' ? 'application/json' : '*/*',
      ...options.headers
    }
    // FormData (multipart): el navegador pone el Content-Type con el boundary.
    if (token) headers.Authorization = `Bearer ${token}`

    try {
      const response = await $fetch(path, {
        baseURL: deps.baseURL,
        method: options.method ?? 'GET',
        body: options.body as Record<string, unknown> | BodyInit | null | undefined,
        query: options.query,
        headers,
        signal: options.signal,
        timeout: options.timeout ?? defaultTimeout,
        responseType,
        retry: 0
      })
      return response as unknown as T
    }
    catch (error) {
      const apiError = normalizeApiError(await readBlobError(error))
      if (apiError.status === 401 && token) deps.onUnauthorized()
      throw apiError
    }
  }
}
