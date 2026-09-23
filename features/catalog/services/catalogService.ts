import type { CatalogService, ProductDetail } from '../types/catalog'
import { MOCK_DELIVERY_AREAS, MOCK_PRODUCTS } from './mockCatalog'
import { useApi } from '~/services/api'
import type { ApiError, HttpClient } from '~/types/api'

const delay = (ms = 300) => new Promise(r => setTimeout(r, ms))

export function createMockCatalogService(): CatalogService {
  return {
    async listProducts() {
      await delay()
      return MOCK_PRODUCTS.map(p => ({
        codigoProducto: p.codigoProducto,
        nombre: p.nombre,
        descripcion: p.descripcion,
        categoria: p.categoria,
        precioDesde: Math.min(...p.variantes.map(v => v.precioActual)),
        permitePersonalizacion: p.permitePersonalizacion
      }))
    },
    async getProduct(codigo) {
      await delay()
      const p = MOCK_PRODUCTS.find(x => x.codigoProducto.toLowerCase() === codigo.trim().toLowerCase())
      if (!p) throw { status: 404, code: 'NOT_FOUND', message: 'No encontramos ese producto.' } satisfies ApiError
      return structuredClone(p)
    },
    async listDeliveryAreas() {
      await delay(150)
      return structuredClone(MOCK_DELIVERY_AREAS)
    }
  }
}

export function createHttpCatalogService(api: HttpClient): CatalogService {
  return {
    listProducts: () => api('/api/catalog/products'),
    async getProduct(codigo) {
      const p = await api<ProductDetail>(`/api/catalog/products/${encodeURIComponent(codigo.trim())}`)
      return { ...p, medidas: p.medidas ?? null, variantes: p.variantes ?? [], zonas: p.zonas ?? [] }
    },
    listDeliveryAreas: () => api('/api/catalog/delivery-areas')
  }
}

/** Catálogo real o de demostración según `runtimeConfig.public.useMocks`. */
export function useShopCatalog(): CatalogService {
  return useRuntimeConfig().public.useMocks ? createMockCatalogService() : createHttpCatalogService(useApi())
}

/** Ícono por categoría para las tarjetas del catálogo. */
export function categoryIcon(categoria: string): string {
  const c = categoria.toLowerCase()
  if (c.includes('llav')) return 'mdi-key-chain-variant'
  if (c.includes('tarj') || c.includes('photo')) return 'mdi-card-account-details-star-outline'
  if (c.includes('im')) return 'mdi-magnet'
  return 'mdi-package-variant-closed'
}
