/** Validaciones del contrato de NfcUrlValidator (backend V5). No escribir en el chip. */
export const NFC_REQUIRED_MESSAGE = 'La URL del NFC debe ser un enlace https válido.'
export const NFC_LONG_MESSAGE = 'La URL del NFC es demasiado larga. Usa un enlace más corto (máximo 2048 caracteres).'
export const NFC_MAX_LENGTH = 2048

export function validateNfcCustomerUrl(value: string): string | null {
  const url = value.trim()
  if (url.length > NFC_MAX_LENGTH) return NFC_LONG_MESSAGE
  if (!url || /\s/.test(url)) return NFC_REQUIRED_MESSAGE
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' || !parsed.hostname || parsed.username || parsed.password) return NFC_REQUIRED_MESSAGE
  }
  catch { return NFC_REQUIRED_MESSAGE }
  return null
}
