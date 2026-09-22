import type { HttpClient } from '~/types/api'

export { normalizeApiError, isApiError } from './errors'
export { createHttpClient } from './httpClient'

/** Acceso al cliente HTTP compartido (provisto por plugins/api.ts). */
export function useApi(): HttpClient {
  return useNuxtApp().$api as HttpClient
}
