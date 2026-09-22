/**
 * Tipos transversales de comunicación con el API.
 */

/** Error normalizado que la UI puede mostrar sin riesgo (nunca trae stack ni errores de BD). */
export interface ApiError {
  /** Código HTTP. 0 = sin conexión / timeout. */
  status: number
  /** Código estable para lógica de UI (p. ej. 'UNAUTHORIZED', 'AppConflictException'). */
  code: string
  /** Mensaje amable para el usuario final. */
  message: string
  /** Errores de validación por campo, cuando el backend los envía. */
  details?: Record<string, string[]>
  /** Id de rastreo del backend para soporte. */
  traceId?: string
}

/**
 * RFC 7807 tal como lo produce el backend (ApiExceptionHandler / ValidationProblemDetails).
 * La sección `debug` solo existe en Development y NUNCA se muestra en la UI.
 */
export interface ProblemDetails {
  type?: string
  title?: string
  status?: number
  detail?: string
  instance?: string
  traceId?: string
  errors?: Record<string, string[]>
  [key: string]: unknown
}

/** Paginación genérica. Provisional: a reconciliar con Swagger cuando existan listados. */
export interface Paginated<T> {
  items: T[]
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

/** Opciones de request soportadas por el cliente HTTP. */
export interface HttpRequestOptions {
  method?: HttpMethod
  body?: BodyInit | Record<string, unknown> | unknown[] | null
  query?: Record<string, string | number | boolean | undefined | null>
  headers?: Record<string, string>
  signal?: AbortSignal
  /** Milisegundos. Por defecto 15000. */
  timeout?: number
}

export type HttpClient = <T = unknown>(path: string, options?: HttpRequestOptions) => Promise<T>
