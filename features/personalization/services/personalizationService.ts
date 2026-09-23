import type { DesignExport, ProductTemplate, SideKey } from '../types/editor'
import { useApi } from '~/services/api'

/**
 * Guarda la personalización (POST /api/personalizations) y la agrega al carrito (POST /api/cart/items).
 * El backend exige por zona: imagen final (base64, máx. 2 MB) y un ConfiguracionJson con
 * al menos `imagen`, `texto` o `stickers` (máx. 3). Incluimos además el JSON de Fabric
 * para poder reabrir el diseño.
 */

const MAX_BYTES = 2 * 1024 * 1024

interface FabricObjectJson { type?: string, ntKind?: string, text?: string, fileId?: string }

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/** Si el PNG supera 2 MB, lo re-codifica a WEBP (conserva la transparencia). */
async function fitUnder2Mb(blob: Blob): Promise<Blob> {
  if (blob.size <= MAX_BYTES) return blob
  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0)
  bitmap.close()
  for (const q of [0.9, 0.8, 0.7]) {
    const out = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/webp', q))
    if (out && out.size <= MAX_BYTES) return out
  }
  throw { status: 400, code: 'IMAGE_TOO_LARGE', message: 'El diseño es demasiado pesado. Usa una imagen más liviana.' }
}

function summarize(objects: FabricObjectJson[]) {
  return {
    imagen: objects.filter(o => o.ntKind === 'image').map(o => ({ fileId: o.fileId ?? null })),
    texto: objects.filter(o => o.ntKind === 'text').map(o => o.text ?? '').join('\n').trim(),
    stickers: objects.filter(o => o.ntKind === 'sticker').map(o => o.text ?? '')
  }
}

export interface SavedPersonalization {
  idPersonalizacion: number
  idDetalleCarrito?: number
}

export function usePersonalizationService() {
  const api = useApi()

  async function save(template: ProductTemplate, result: DesignExport): Promise<number> {
    if (!template.idVariante || !template.zoneIds) throw { status: 400, code: 'NO_VARIANT', message: 'Este producto no está disponible en el catálogo.' }
    const zonas = []
    for (const [key, idZona] of Object.entries(template.zoneIds) as [SideKey, number][]) {
      const zone = result.design.zones[key]
      const png = result.images[key]
      if (!zone || !png) continue
      const image = await fitUnder2Mb(png)
      const objects = ((zone.fabric as { objects?: FabricObjectJson[] }).objects ?? [])
      zonas.push({
        idZona,
        configuracionJson: JSON.stringify({ version: zone.version, width: zone.width, height: zone.height, ...summarize(objects), fabric: zone.fabric }),
        imagenBase64: await toBase64(image),
        nombreArchivo: `${template.code}-lado-${key}.${image.type === 'image/webp' ? 'webp' : 'png'}`,
        tipoMime: image.type || 'image/png'
      })
    }
    const created = await api<{ idPersonalizacion: number }>('/api/personalizations', {
      method: 'POST',
      body: { idVariante: template.idVariante, zonas },
      timeout: 60_000
    })
    return created.idPersonalizacion
  }

  async function addToCart(idVariante: number, idPersonalizacion: number, cantidad = 1): Promise<void> {
    await api('/api/cart/items', { method: 'POST', body: { idVariante, cantidad, idPersonalizacion } })
  }

  return { save, addToCart }
}
