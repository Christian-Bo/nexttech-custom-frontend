import type { JwtClaims } from '~/types/auth'

const ROLE_CLAIM_LONG = 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role'

/**
 * Decodifica el payload de un JWT SIN validar la firma.
 * Solo para leer claims en la UI; la autorización real siempre la decide el backend.
 */
export function decodeJwt(token: string): JwtClaims | null {
  const part = token.split('.')[1]
  if (!part) return null

  try {
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
    const bytes = Uint8Array.from(atob(padded), c => c.charCodeAt(0))
    const raw = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>

    if (raw.role === undefined && raw[ROLE_CLAIM_LONG] !== undefined) {
      raw.role = raw[ROLE_CLAIM_LONG]
    }

    return raw as JwtClaims
  }
  catch {
    return null
  }
}
