/**
 * Teléfonos de Guatemala.
 *
 * El comprador escribe solo sus 8 dígitos nacionales y la UI muestra el
 * prefijo +502 fijo. El backend acepta ambos formatos y normaliza el
 * destinatario antes de enviar WhatsApp, así que mandamos los 8 dígitos.
 *
 * Importante: el backend rechaza el registro con 400 si el comprador activa
 * WhatsApp y el teléfono no son 8 dígitos de Guatemala o 502 + 8 dígitos.
 */

/** Cantidad de dígitos de un número nacional guatemalteco. */
export const GT_PHONE_DIGITS = 8

/** Código de país que se muestra como prefijo fijo en los formularios. */
export const GT_COUNTRY_PREFIX = '+502'

/**
 * Deja solo los 8 dígitos nacionales, venga como venga.
 *
 *   '55550101'        -> '55550101'
 *   '50255550101'     -> '55550101'
 *   '+502 5555-0101'  -> '55550101'
 *   ''                -> ''
 */
export function toLocalGtDigits(value: string | null | undefined): string {
  const digits = (value ?? '').replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('502')) return digits.slice(3)
  if (digits.length > GT_PHONE_DIGITS) return digits.slice(-GT_PHONE_DIGITS)
  return digits
}

/** Recorta lo que el usuario escribe a 8 dígitos, descartando cualquier otro carácter. */
export function sanitizeGtInput(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '').slice(0, GT_PHONE_DIGITS)
}

/** true si son exactamente 8 dígitos. */
export function isValidGtPhone(value: string | null | undefined): boolean {
  return /^\d{8}$/.test((value ?? '').trim())
}

/** Regla para los formularios de Vuetify. */
export function gtPhoneRule(value: string): true | string {
  return isValidGtPhone(value) || 'Escribe los 8 dígitos de tu número (sin el 502).'
}

/** Lo que se manda al backend: los 8 dígitos nacionales. */
export function toBackendPhone(value: string): string {
  return toLocalGtDigits(value)
}

/** Para mostrar un número guardado: '+502 5555-0101'. */
export function formatGtPhone(value: string | null | undefined): string {
  const local = toLocalGtDigits(value)
  if (!isValidGtPhone(local)) return value?.trim() ?? ''
  return `${GT_COUNTRY_PREFIX} ${local.slice(0, 4)}-${local.slice(4)}`
}
