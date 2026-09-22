import type { ApiError, ProblemDetails } from '~/types/api'

/**
 * Normaliza cualquier error de red/HTTP a ApiError.
 * Regla OWASP: para 5xx nunca se muestra el detalle del backend
 * (en Development trae mensajes de excepción y una sección `debug`).
 */

const STATUS_CODES: Record<number, string> = {
  0: 'NETWORK_ERROR',
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  422: 'UNPROCESSABLE',
  429: 'TOO_MANY_REQUESTS',
  503: 'SERVICE_UNAVAILABLE'
}

const FRIENDLY_MESSAGES: Record<number, string> = {
  0: 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.',
  400: 'Revisa los datos ingresados.',
  401: 'Tu sesión expiró o no es válida. Inicia sesión de nuevo.',
  403: 'No tienes permiso para realizar esta acción.',
  404: 'No encontramos lo que buscabas.',
  409: 'La operación entra en conflicto con información existente.',
  413: 'El archivo es demasiado grande.',
  422: 'No se pudo procesar la solicitud.',
  429: 'Demasiados intentos. Espera un momento e inténtalo de nuevo.',
  503: 'El servicio no está disponible en este momento. Inténtalo más tarde.'
}

const GENERIC_SERVER_MESSAGE = 'Ocurrió un problema en el servidor. Inténtalo más tarde.'
const TIMEOUT_MESSAGE = 'El servidor tardó demasiado en responder. Inténtalo de nuevo.'

/** Títulos que son códigos de AppException del backend (p. ej. "AppConflictException"). */
const ERROR_CODE_PATTERN = /^[A-Z][A-Za-z0-9_]+$/

interface FetchLikeError {
  name?: string
  message?: string
  status?: number
  statusCode?: number
  data?: unknown
  cause?: unknown
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function isApiError(value: unknown): value is ApiError {
  return isObject(value)
    && typeof value.status === 'number'
    && typeof value.code === 'string'
    && typeof value.message === 'string'
}

function isTimeout(error: FetchLikeError): boolean {
  const cause = isObject(error.cause) ? error.cause : undefined
  return error.name === 'TimeoutError'
    || cause?.name === 'TimeoutError'
    || /timeout/i.test(error.message ?? '')
}

function isAbort(error: FetchLikeError): boolean {
  const cause = isObject(error.cause) ? error.cause : undefined
  return error.name === 'AbortError' || cause?.name === 'AbortError'
}

function firstValidationMessage(errors?: Record<string, string[]>): string | undefined {
  if (!errors) return undefined
  for (const messages of Object.values(errors)) {
    if (messages?.[0]) return messages[0]
  }
  return undefined
}

export function normalizeApiError(error: unknown): ApiError {
  if (isApiError(error)) return error

  const e: FetchLikeError = isObject(error) ? (error as FetchLikeError) : {}
  const status = e.statusCode ?? e.status ?? 0

  if (status === 0) {
    if (isTimeout(e)) return { status: 0, code: 'TIMEOUT', message: TIMEOUT_MESSAGE }
    if (isAbort(e)) return { status: 0, code: 'ABORTED', message: 'La solicitud fue cancelada.' }
    return { status: 0, code: STATUS_CODES[0]!, message: FRIENDLY_MESSAGES[0]! }
  }

  const problem: ProblemDetails = isObject(e.data) ? (e.data as ProblemDetails) : {}
  const traceId = typeof problem.traceId === 'string' ? problem.traceId : undefined
  const details = isObject(problem.errors) ? problem.errors : undefined

  const code = problem.title && ERROR_CODE_PATTERN.test(problem.title)
    ? problem.title
    : STATUS_CODES[status] ?? `HTTP_${status}`

  let message: string
  if (status >= 500) {
    message = FRIENDLY_MESSAGES[status] ?? GENERIC_SERVER_MESSAGE
  }
  else {
    message = firstValidationMessage(details)
      ?? (typeof problem.detail === 'string' && problem.detail.trim() ? problem.detail : undefined)
      ?? FRIENDLY_MESSAGES[status]
      ?? 'No se pudo completar la solicitud.'
  }

  return { status, code, message, details, traceId }
}
