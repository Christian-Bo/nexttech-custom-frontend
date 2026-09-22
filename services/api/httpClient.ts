import type { HttpClient, HttpRequestOptions } from '~/types/api'
import { normalizeApiError } from './errors'

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
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...options.headers
    }
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
        retry: 0
      })
      return response as unknown as T
    }
    catch (error) {
      const apiError = normalizeApiError(error)
      if (apiError.status === 401 && token) deps.onUnauthorized()
      throw apiError
    }
  }
}
