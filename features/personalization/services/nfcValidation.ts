/** Validaciones del contrato de NfcUrlValidator (backend V5). No escribir en el chip. */
export const NFC_REQUIRED_MESSAGE = 'La URL del NFC debe ser un enlace https válido.'
export const NFC_INSECURE_MESSAGE = 'El enlace debe ser seguro (https). Cambia http:// por https://'
export const NFC_LONG_MESSAGE = 'La URL del NFC es demasiado larga. Usa un enlace más corto (máximo 2048 caracteres).'
export const NFC_MAX_LENGTH = 2048

/** Un esquema explícito al inicio: https:, http:, javascript:, mailto:… */
const CON_ESQUEMA = /^[a-z][a-z0-9+.-]*:/i

/**
 * Completa el protocolo como hace la barra del navegador:
 *
 *   'www.google.com'       -> 'https://www.google.com'
 *   'google.com/algo'      -> 'https://google.com/algo'
 *   'https://ejemplo.com'  -> sin cambios
 *   'http://ejemplo.com'   -> sin cambios (lo rechaza el validador: el contrato exige https)
 *   'javascript:alert(1)'  -> sin cambios (lo rechaza el validador)
 *
 * Nunca convierte http en https: si el comprador escribió http a propósito,
 * se le avisa en vez de cambiarle el destino por detrás.
 */
export function normalizeNfcCustomerUrl(value: string): string {
  const url = (value ?? '').trim()
  if (!url) return ''
  return CON_ESQUEMA.test(url) ? url : `https://${url}`
}

export function validateNfcCustomerUrl(value: string): string | null {
  const url = normalizeNfcCustomerUrl(value)
  if (url.length > NFC_MAX_LENGTH) return NFC_LONG_MESSAGE
  if (!url || /\s/.test(url)) return NFC_REQUIRED_MESSAGE
  try {
    const parsed = new URL(url)
    // Mensaje propio para http: es el error más común y tiene arreglo obvio.
    if (parsed.protocol === 'http:') return NFC_INSECURE_MESSAGE
    if (parsed.protocol !== 'https:' || !parsed.hostname || parsed.username || parsed.password) {
      return NFC_REQUIRED_MESSAGE
    }
  }
  catch { return NFC_REQUIRED_MESSAGE }
  return null
}
