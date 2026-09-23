/**
 * Estudio de foto del comprador: lógica pura (sin DOM) + dibujo sobre un canvas 2D.
 * El retrato final es 600 x 800 (3:4), el mismo tamaño que usa el backend para la credencial.
 */

export const PORTRAIT_WIDTH = 600
export const PORTRAIT_HEIGHT = 800
export const MAX_PORTRAIT_STICKERS = 3
export const MIN_ZOOM = 1
export const MAX_ZOOM = 3

export type PortraitFilterName = 'none' | 'grayscale' | 'sepia' | 'vivid' | 'cool' | 'warm' | 'bright'

export interface PortraitFilter {
  name: PortraitFilterName
  label: string
  /** Valor para CanvasRenderingContext2D.filter / CSS filter. */
  css: string
}

export const PORTRAIT_FILTERS: readonly PortraitFilter[] = [
  { name: 'none', label: 'Original', css: 'none' },
  { name: 'bright', label: 'Luminoso', css: 'brightness(1.15) contrast(1.05)' },
  { name: 'vivid', label: 'Vívido', css: 'saturate(1.5) contrast(1.1)' },
  { name: 'warm', label: 'Cálido', css: 'sepia(0.25) saturate(1.3) hue-rotate(-10deg)' },
  { name: 'cool', label: 'Frío', css: 'saturate(1.1) hue-rotate(15deg) brightness(1.05)' },
  { name: 'sepia', label: 'Sepia', css: 'sepia(0.85)' },
  { name: 'grayscale', label: 'Blanco y negro', css: 'grayscale(1) contrast(1.1)' }
]

export const PORTRAIT_STICKERS = ['😎', '🎓', '⭐', '💙', '🚀', '🔥', '👑', '🎧', '💻', '✨'] as const

export const PORTRAIT_BACKGROUNDS = ['#1E293B', '#2563EB', '#06B6D4', '#F8FAFC', '#0F172A'] as const

export interface PortraitSticker {
  id: number
  emoji: string
  /** Centro normalizado 0..1 dentro del retrato. */
  x: number
  y: number
  /** Tamaño relativo al ancho del retrato (0.08..0.4). */
  size: number
}

export interface PortraitState {
  zoom: number
  /** Desplazamiento normalizado -1..1 (0 = centrado). */
  panX: number
  panY: number
  filter: PortraitFilterName
  stickers: PortraitSticker[]
  /** Color de fondo; solo se ve si la imagen tiene transparencia (recorte automático). */
  background: string
  /** Máscara ovalada alrededor del rostro. */
  oval: boolean
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export function createPortraitState(): PortraitState {
  return { zoom: 1.2, panX: 0, panY: -0.1, filter: 'none', stickers: [], background: PORTRAIT_BACKGROUNDS[0], oval: false }
}

export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min
  return Math.min(max, Math.max(min, value))
}

export function filterCss(name: PortraitFilterName): string {
  return PORTRAIT_FILTERS.find(f => f.name === name)?.css ?? 'none'
}

/**
 * Rectángulo de la imagen original que se recorta para el retrato 3:4.
 * Primero ajusta la imagen para cubrir el retrato ("cover"), luego aplica zoom y desplazamiento
 * sin salirse nunca de la imagen.
 */
export function computeSourceRect(
  imageWidth: number,
  imageHeight: number,
  zoom: number,
  panX: number,
  panY: number,
  aspect = PORTRAIT_WIDTH / PORTRAIT_HEIGHT
): Rect {
  if (imageWidth <= 0 || imageHeight <= 0) return { x: 0, y: 0, width: 0, height: 0 }
  const z = clamp(zoom, MIN_ZOOM, MAX_ZOOM)

  // Recorte máximo con la proporción del retrato.
  let baseW = imageWidth
  let baseH = imageWidth / aspect
  if (baseH > imageHeight) {
    baseH = imageHeight
    baseW = imageHeight * aspect
  }

  const width = baseW / z
  const height = baseH / z
  const freeX = imageWidth - width
  const freeY = imageHeight - height
  const x = freeX / 2 + (clamp(panX, -1, 1) * freeX) / 2
  const y = freeY / 2 + (clamp(panY, -1, 1) * freeY) / 2
  return { x, y, width, height }
}

/**
 * Convierte un arrastre en píxeles de pantalla a un nuevo pan normalizado.
 * Arrastrar a la derecha mueve la foto a la derecha (se ve más de la izquierda).
 */
export function panFromDrag(
  state: Pick<PortraitState, 'panX' | 'panY'>,
  dxPx: number,
  dyPx: number,
  viewWidthPx: number,
  viewHeightPx: number,
  source: Rect,
  imageWidth: number,
  imageHeight: number
): { panX: number, panY: number } {
  const freeX = imageWidth - source.width
  const freeY = imageHeight - source.height
  const scaleX = source.width / Math.max(1, viewWidthPx)
  const scaleY = source.height / Math.max(1, viewHeightPx)
  const panX = freeX > 0 ? state.panX - (dxPx * scaleX * 2) / freeX : 0
  const panY = freeY > 0 ? state.panY - (dyPx * scaleY * 2) / freeY : 0
  return { panX: clamp(panX, -1, 1), panY: clamp(panY, -1, 1) }
}

let stickerSeq = 1

/** Devuelve la lista nueva o null si ya se alcanzó el máximo. */
export function addSticker(list: readonly PortraitSticker[], emoji: string): PortraitSticker[] | null {
  if (list.length >= MAX_PORTRAIT_STICKERS) return null
  const offsets = [[0.78, 0.18], [0.22, 0.2], [0.8, 0.82]] as const
  const [x, y] = offsets[list.length % offsets.length]!
  return [...list, { id: stickerSeq++, emoji, x, y, size: 0.16 }]
}

export function moveSticker(list: readonly PortraitSticker[], id: number, x: number, y: number): PortraitSticker[] {
  return list.map(s => (s.id === id ? { ...s, x: clamp(x, 0, 1), y: clamp(y, 0, 1) } : s))
}

export function resizeSticker(list: readonly PortraitSticker[], id: number, size: number): PortraitSticker[] {
  return list.map(s => (s.id === id ? { ...s, size: clamp(size, 0.08, 0.4) } : s))
}

export function removeSticker(list: readonly PortraitSticker[], id: number): PortraitSticker[] {
  return list.filter(s => s.id !== id)
}

/** Sticker bajo un punto normalizado (el de más arriba primero), o null. */
export function hitSticker(list: readonly PortraitSticker[], x: number, y: number, aspect = PORTRAIT_WIDTH / PORTRAIT_HEIGHT): PortraitSticker | null {
  for (let i = list.length - 1; i >= 0; i--) {
    const s = list[i]!
    const half = s.size / 2
    if (Math.abs(x - s.x) <= half && Math.abs(y - s.y) <= half * aspect) return s
  }
  return null
}

type DrawableImage = CanvasImageSource & { width: number, height: number }

/** Dibuja el retrato completo (fondo, foto recortada con filtro, máscara y stickers). */
export function drawPortrait(
  ctx: CanvasRenderingContext2D,
  image: DrawableImage,
  state: PortraitState,
  width = PORTRAIT_WIDTH,
  height = PORTRAIT_HEIGHT
): void {
  const src = computeSourceRect(image.width, image.height, state.zoom, state.panX, state.panY, width / height)

  ctx.save()
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = state.background
  ctx.fillRect(0, 0, width, height)

  if (state.oval) {
    ctx.beginPath()
    ctx.ellipse(width / 2, height * 0.47, width * 0.44, height * 0.43, 0, 0, Math.PI * 2)
    ctx.clip()
  }

  ctx.filter = filterCss(state.filter)
  ctx.drawImage(image, src.x, src.y, src.width, src.height, 0, 0, width, height)
  ctx.restore()

  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const s of state.stickers) {
    ctx.font = `${Math.round(s.size * width)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`
    ctx.fillText(s.emoji, s.x * width, s.y * height)
  }
  ctx.restore()
}
