import type { ProductTemplate, ZoneTemplate } from '../types/editor'

const SIDES_AB: ZoneTemplate[] = [
  { key: 'A', name: 'Lado A', required: true },
  { key: 'B', name: 'Lado B', required: true }
]

/**
 * Plantillas por variante.
 * Llaveros: tomados del seed de SQL Server (PlantillaVarianteZona, 800x800).
 * Photocard e imán: PROVISIONALES hasta que existan en BD (acordar con Integrante 3).
 */
export const PRODUCT_TEMPLATES: ProductTemplate[] = [
  { code: 'LLV-ACR-CIR-MED', name: 'Llavero acrílico circular', shape: 'CIRCULAR', width: 800, height: 800, zones: SIDES_AB },
  { code: 'LLV-ACR-CUA-MED', name: 'Llavero acrílico cuadrado', shape: 'CUADRADO', width: 800, height: 800, cornerRadius: 60, zones: SIDES_AB },
  { code: 'LLV-MET-CIR-MED', name: 'Llavero metálico circular', shape: 'CIRCULAR', width: 800, height: 800, zones: SIDES_AB },
  { code: 'LLV-MET-CUA-MED', name: 'Llavero metálico cuadrado', shape: 'CUADRADO', width: 800, height: 800, cornerRadius: 60, zones: SIDES_AB },
  { code: 'PHC-STD', name: 'Photocard', shape: 'RECTANGULAR', width: 640, height: 1000, cornerRadius: 36, zones: SIDES_AB, provisional: true },
  { code: 'IMN-RECT', name: 'Imán rectangular', shape: 'RECTANGULAR', width: 900, height: 600, cornerRadius: 24, zones: [{ key: 'A', name: 'Lado A', required: true }], provisional: true }
]

export function findTemplate(code: string | null | undefined): ProductTemplate | undefined {
  return PRODUCT_TEMPLATES.find(t => t.code === code)
}

export const DEFAULT_TEMPLATE_CODE = 'LLV-ACR-CIR-MED'

/** Stickers = emojis como texto (sin archivos externos). */
export const STICKERS = ['⭐', '💖', '🔥', '🎮', '🎵', '🌸', '🐱', '🐶', '⚡', '🌈', '👑', '🍀', '🚀', '😎', '🎀', '✨']

export const EDITOR_FONTS = ['Inter', 'Georgia', 'Courier New', 'Impact', 'Comic Sans MS', 'Trebuchet MS']

export const EDITOR_COLORS = ['#F8FAFC', '#0F172A', '#2563EB', '#06B6D4', '#22C55E', '#F59E0B', '#EF4444', '#A855F7', '#EC4899']
