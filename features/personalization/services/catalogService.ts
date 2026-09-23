import type { ProductShape, ProductTemplate, SideKey, ZoneTemplate } from '../types/editor'
import { useApi } from '~/services/api'

/** Catálogo real (Integrante 3): GET /api/catalog/products y /products/{codigo}. */

interface ProductoResumenApi { codigoProducto: string, nombre: string, permitePersonalizacion: boolean }
interface ZonaApi { idZona: number, nombre: string, esObligatoria: boolean, ordenVisual: number }
interface PlantillaApi { idZona: number, forma: string, anchoLienzo: number, altoLienzo: number }
interface VarianteApi { idVariante: number, codigoVariante: string, nombre: string, precioActual: number, plantillas: PlantillaApi[] }
interface ProductoDetalleApi {
  codigoProducto: string
  nombre: string
  permitePersonalizacion: boolean
  variantes: VarianteApi[]
  zonas: ZonaApi[]
}

const SIDE_KEYS: SideKey[] = ['A', 'B']

function toShape(forma: string): ProductShape {
  const f = forma.toUpperCase()
  if (f.startsWith('CIRC')) return 'CIRCULAR'
  if (f.startsWith('CUAD')) return 'CUADRADO'
  return 'RECTANGULAR'
}

/** Convierte cada variante personalizable en una plantilla del editor. */
function toTemplates(p: ProductoDetalleApi): ProductTemplate[] {
  const zonas = [...p.zonas].sort((a, b) => a.ordenVisual - b.ordenVisual).slice(0, SIDE_KEYS.length)
  return p.variantes
    .filter(v => v.plantillas.length > 0)
    .map((v) => {
      const plantilla = v.plantillas[0]!
      const shape = toShape(plantilla.forma)
      const zones: ZoneTemplate[] = zonas.map((z, i) => ({ key: SIDE_KEYS[i]!, name: z.nombre, required: z.esObligatoria }))
      const zoneIds: Partial<Record<SideKey, number>> = {}
      zonas.forEach((z, i) => (zoneIds[SIDE_KEYS[i]!] = z.idZona))
      return {
        code: v.codigoVariante,
        name: `${p.nombre} · ${v.nombre}`,
        shape,
        width: plantilla.anchoLienzo,
        height: plantilla.altoLienzo,
        cornerRadius: shape === 'CIRCULAR' ? undefined : Math.round(plantilla.anchoLienzo * 0.075),
        zones,
        idVariante: v.idVariante,
        zoneIds,
        price: v.precioActual
      } satisfies ProductTemplate
    })
}

export function useCatalogService() {
  const api = useApi()
  return {
    /** Todas las variantes personalizables del catálogo como plantillas del editor. */
    async listTemplates(): Promise<ProductTemplate[]> {
      const productos = await api<ProductoResumenApi[]>('/api/catalog/products')
      const detalles = await Promise.all(
        productos
          .filter(p => p.permitePersonalizacion)
          .map(p => api<ProductoDetalleApi>(`/api/catalog/products/${encodeURIComponent(p.codigoProducto)}`))
      )
      return detalles.flatMap(toTemplates)
    }
  }
}
