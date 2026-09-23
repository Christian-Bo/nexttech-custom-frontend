import type { HttpClient, HttpRequestOptions } from '~/types/api'
import { normalizeApiError } from './errors'

/** Si una respuesta 'blob' falló, el ProblemDetails llega como Blob: lo convierte a JSON. */
async function readBlobError(error: unknown): Promise<unknown> {
  const e = error as { data?: unknown }
  if (typeof Blob !== 'undefined' && e?.data instanceof Blob) {
    try {
      e.data = JSON.parse(await e.data.text())
    }
    catch {
      e.data = undefined
    }
  }
  return error
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
