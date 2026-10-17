/**
 * Preferencias EXCLUSIVAMENTE visuales de la credencial mostrada en el navegador.
 * No representan la credencial oficial, no contienen fotografía, QR, JWT ni PDF.
 */
export type VisualCredentialTheme = 'BLUE_NEON' | 'DARK_CARBON' | 'PURPLE_PULSE'

export interface VisualCredentialSticker {
  uid: string
  stickerId: string
  /** Coordenadas relativas al área de fotografía: 0..1 */
  x: number
  y: number
  /** Tamaño como proporción del ancho de la fotografía: 0.09..0.36 */
  size: number
  rotation: number
}

export interface VisualCredentialDesign {
  version: 1
  theme: VisualCredentialTheme
  stickers: VisualCredentialSticker[]
}

export const VISUAL_CREDENTIAL_MAX_STICKERS = 12
export const VISUAL_CREDENTIAL_STORAGE_PREFIX = 'nexttech:credential-visual:v1:buyer:'

export function defaultVisualCredentialDesign(): VisualCredentialDesign {
  return { version: 1, theme: 'BLUE_NEON', stickers: [] }
}

export function visualCredentialStorageKey(buyerId: number | null | undefined): string | null {
  if (!Number.isSafeInteger(buyerId) || !buyerId || buyerId <= 0) return null
  return `${VISUAL_CREDENTIAL_STORAGE_PREFIX}${buyerId}`
}

export function clampCredentialNumber(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback
}

/** Normaliza una preferencia guardada antes de mostrarla. Nunca confía en JSON arbitrario. */
export function normalizeVisualCredentialDesign(value: unknown): VisualCredentialDesign {
  const defaults = defaultVisualCredentialDesign()
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return defaults
  const obj = value as Record<string, unknown>
  if (obj.version !== 1) return defaults
  const theme = (['BLUE_NEON', 'DARK_CARBON', 'PURPLE_PULSE'] as const).find(t => t === obj.theme) ?? defaults.theme
  const inputStickers = Array.isArray(obj.stickers) ? obj.stickers : []
  const unique = new Set<string>()
  const stickers: VisualCredentialSticker[] = []
  for (const raw of inputStickers) {
    if (stickers.length >= VISUAL_CREDENTIAL_MAX_STICKERS) break
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) continue
    const s = raw as Record<string, unknown>
    if (typeof s.uid !== 'string' || !/^[a-zA-Z0-9_-]{1,75}$/.test(s.uid) || unique.has(s.uid)) continue
    if (typeof s.stickerId !== 'string' || !/^[A-Z0-9_-]{1,48}$/.test(s.stickerId)) continue
    unique.add(s.uid)
    stickers.push({
      uid: s.uid,
      stickerId: s.stickerId,
      x: clampCredentialNumber(s.x, 0, 1, 0.5),
      y: clampCredentialNumber(s.y, 0, 1, 0.5),
      size: clampCredentialNumber(s.size, 0.09, 0.36, 0.18),
      rotation: clampCredentialNumber(s.rotation, -180, 180, 0)
    })
  }
  return { version: 1, theme, stickers }
}
