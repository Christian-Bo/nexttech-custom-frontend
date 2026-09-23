/**
 * Miniaturas de los diseños (Lado A) para mostrarlas en el carrito y en "Mis pedidos".
 * El backend no devuelve la imagen del diseño en el carrito, así que se guarda una copia
 * pequeña en este navegador, indexada por idPersonalizacion.
 */
const KEY = 'nt-design-previews'
const MAX_ENTRIES = 40

type PreviewMap = Record<string, string>

function read(): PreviewMap {
  if (!import.meta.client) return {}
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as PreviewMap
  }
  catch {
    return {}
  }
}

export function getDesignPreview(idPersonalizacion: number | null | undefined): string | null {
  if (idPersonalizacion === null || idPersonalizacion === undefined) return null
  return read()[String(idPersonalizacion)] ?? null
}

async function toThumbnail(blob: Blob, maxSide = 240): Promise<string> {
  const bitmap = await createImageBitmap(blob)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas.toDataURL('image/webp', 0.8)
}

export async function saveDesignPreview(idPersonalizacion: number, image: Blob | undefined): Promise<void> {
  if (!image) return
  try {
    const entries = Object.entries(read())
    entries.push([String(idPersonalizacion), await toThumbnail(image)])
    // Solo se guardan las más recientes para no llenar el almacenamiento.
    localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(entries.slice(-MAX_ENTRIES))))
  }
  catch {
    // La miniatura es opcional.
  }
}
