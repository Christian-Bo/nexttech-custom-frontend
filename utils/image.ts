/**
 * Pipeline de imágenes (client-only): validar -> orientar -> redimensionar -> comprimir -> Blob.
 * Todo con canvas nativo, sin dependencias.
 */

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024

export interface ProcessImageOptions {
  /** Lado mayor máximo en px. */
  maxSide?: number
  /** 0..1 */
  quality?: number
}

export class ImageValidationError extends Error {}

export function validateImageFile(file: Blob): void {
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    throw new ImageValidationError('Formato no permitido. Usa una imagen JPG, PNG o WEBP.')
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new ImageValidationError('La imagen supera los 10 MB.')
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise(resolve => canvas.toBlob(resolve, type, quality))
}

/**
 * Devuelve un Blob optimizado. Respeta la orientación EXIF y la transparencia (WEBP; PNG como respaldo).
 */
export async function processImage(file: Blob, options: ProcessImageOptions = {}): Promise<Blob> {
  validateImageFile(file)
  const maxSide = options.maxSide ?? 2000
  const quality = options.quality ?? 0.85

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  }
  catch {
    throw new ImageValidationError('No se pudo leer la imagen. Puede estar dañada.')
  }

  try {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new ImageValidationError('Tu navegador no pudo procesar la imagen.')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, 0, 0, width, height)

    const webp = await canvasToBlob(canvas, 'image/webp', quality)
    if (webp && webp.type === 'image/webp') return webp
    const png = await canvasToBlob(canvas, 'image/png', quality)
    if (png) return png
    throw new ImageValidationError('No se pudo comprimir la imagen.')
  }
  finally {
    bitmap.close()
  }
}
