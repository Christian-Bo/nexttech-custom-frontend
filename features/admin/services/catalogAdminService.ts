import type { AdminArea, AdminCategory, AdminProductDetail, CatalogAdminService } from '../types/catalogAdmin'
import { MOCK_DELIVERY_AREAS, MOCK_PRODUCTS } from '~/features/catalog/services/mockCatalog'
import { useApi } from '~/services/api'
import type { ApiError, HttpClient } from '~/types/api'

const BASE = '/api/admin/catalog'
const enc = encodeURIComponent

export function createHttpCatalogAdminService(api: HttpClient): CatalogAdminService {
  const post = (path: string, body?: unknown) => api(`${BASE}${path}`, { method: 'POST', body: body as Record<string, unknown> | undefined })
  const put = (path: string, body: unknown) => api(`${BASE}${path}`, { method: 'PUT', body: body as Record<string, unknown> })
  return {
    categories: () => api(`${BASE}/categories`),
    createCategory: f => post('/categories', f),
    updateCategory: (id, f) => put(`/categories/${id}`, f),
    setCategoryActive: (id, a) => post(`/categories/${id}/${a ? 'activate' : 'deactivate'}`),

    products: () => api(`${BASE}/products`),
    product: codigo => api(`${BASE}/products/${enc(codigo)}`),
    createProduct: f => post('/products', f),
    updateProduct: (codigo, f) => put(`/products/${enc(codigo)}`, f),
    setProductActive: (codigo, a) => post(`/products/${enc(codigo)}/${a ? 'activate' : 'deactivate'}`),

    createVariant: (codigo, f) => post(`/products/${enc(codigo)}/variants`, f),
    updateVariant: (id, f) => put(`/variants/${id}`, f),
    setVariantActive: (id, a) => post(`/variants/${id}/${a ? 'activate' : 'deactivate'}`),

    areas: () => api(`${BASE}/delivery-areas`),
    createArea: f => post('/delivery-areas', f),
    updateArea: (id, f) => put(`/delivery-areas/${id}`, f),
    setAreaActive: (id, a) => post(`/delivery-areas/${id}/${a ? 'activate' : 'deactivate'}`)
  }
}

function copy<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

/** Catálogo de demostración editable en memoria (se reinicia al recargar). */
export function createMockCatalogAdminService(): CatalogAdminService {
  const state = useState('nt-mock-admin-catalog', () => {
    const categorias = [...new Set(MOCK_PRODUCTS.map(p => p.categoria))]
    const categories: AdminCategory[] = categorias.map((nombre, i) => ({ idCategoria: i + 1, nombre, descripcion: null, activo: true }))
    const products: AdminProductDetail[] = MOCK_PRODUCTS.map((p, i) => ({
      idProducto: i + 1,
      idCategoria: categories.find(c => c.nombre === p.categoria)!.idCategoria,
      codigoProducto: p.codigoProducto,
      nombre: p.nombre,
      descripcion: p.descripcion,
      categoria: p.categoria,
      precioBase: p.precioBase,
      permitePersonalizacion: p.permitePersonalizacion,
      activo: true,
      zonas: p.zonas,
      variantes: p.variantes.map(v => ({
        idVariante: v.idVariante,
        codigoVariante: v.codigoVariante,
        nombre: v.nombre,
        descripcion: null,
        precioAdicional: v.precioAdicional,
        precioActual: v.precioActual,
        activo: true,
        formaLienzo: v.plantillas[0]?.forma.startsWith('CUAD') ? 'CUADRADA' : 'CIRCULAR'
      }))
    }))
    const areas: AdminArea[] = MOCK_DELIVERY_AREAS.map(a => ({ ...a, activo: true }))
    return { categories, products, areas }
  })
  const wait = () => new Promise(r => setTimeout(r, 200))
  const notFound = (m: string): ApiError => ({ status: 404, code: 'NOT_FOUND', message: m })
  const prod = (codigo: string) => {
    const p = state.value.products.find(x => x.codigoProducto === codigo)
    if (!p) throw notFound('El producto no existe.')
    return p
  }
  const variant = (id: number) => {
    for (const p of state.value.products) {
      const v = p.variantes.find(x => x.idVariante === id)
      if (v) return { p, v }
    }
    throw notFound('La variante no existe.')
  }
  const categoryName = (id: number) => state.value.categories.find(c => c.idCategoria === id)?.nombre ?? '—'
  const nextId = (ids: number[]) => Math.max(0, ...ids) + 1

  return {
    async categories() {
      await wait()
      return copy(state.value.categories)
    },
    async createCategory(f) {
      await wait()
      state.value.categories.push({ idCategoria: nextId(state.value.categories.map(c => c.idCategoria)), nombre: f.nombre, descripcion: f.descripcion, activo: true })
    },
    async updateCategory(id, f) {
      await wait()
      Object.assign(state.value.categories.find(c => c.idCategoria === id) ?? {}, f)
    },
    async setCategoryActive(id, a) {
      await wait()
      Object.assign(state.value.categories.find(c => c.idCategoria === id) ?? {}, { activo: a })
    },

    async products() {
      await wait()
      return state.value.products.map(p => ({
        idProducto: p.idProducto,
        codigoProducto: p.codigoProducto,
        nombre: p.nombre,
        categoria: categoryName(p.idCategoria),
        precioBase: p.precioBase,
        permitePersonalizacion: p.permitePersonalizacion,
        activo: p.activo,
        variantesActivas: p.variantes.filter(v => v.activo).length
      }))
    },
    async product(codigo) {
      await wait()
      return copy({ ...prod(codigo), categoria: categoryName(prod(codigo).idCategoria) })
    },
    async createProduct(f) {
      await wait()
      if (state.value.products.some(p => p.codigoProducto.toUpperCase() === f.codigoProducto.toUpperCase())) {
        throw { status: 409, code: 'CONFLICT', message: 'Ya existe un producto con ese código.' } satisfies ApiError
      }
      state.value.products.push({
        ...f,
        idProducto: nextId(state.value.products.map(p => p.idProducto)),
        categoria: categoryName(f.idCategoria),
        activo: true,
        zonas: f.permitePersonalizacion ? [{ idZona: 1, nombre: 'Lado A', esObligatoria: true, ordenVisual: 1 }, { idZona: 2, nombre: 'Lado B', esObligatoria: true, ordenVisual: 2 }] : [],
        variantes: []
      })
    },
    async updateProduct(codigo, f) {
      await wait()
      const p = prod(codigo)
      Object.assign(p, f, { categoria: categoryName(f.idCategoria) })
      for (const v of p.variantes) v.precioActual = f.precioBase + v.precioAdicional
    },
    async setProductActive(codigo, a) {
      await wait()
      prod(codigo).activo = a
    },

    async createVariant(codigo, f) {
      await wait()
      const p = prod(codigo)
      const ids = state.value.products.flatMap(x => x.variantes.map(v => v.idVariante))
      p.variantes.push({ ...f, idVariante: nextId(ids), precioActual: p.precioBase + f.precioAdicional, activo: true })
    },
    async updateVariant(id, f) {
      await wait()
      const { p, v } = variant(id)
      Object.assign(v, f, { precioActual: p.precioBase + f.precioAdicional })
    },
    async setVariantActive(id, a) {
      await wait()
      variant(id).v.activo = a
    },

    async areas() {
      await wait()
      return copy(state.value.areas)
    },
    async createArea(f) {
      await wait()
      state.value.areas.push({ idAreaEntrega: nextId(state.value.areas.map(a => a.idAreaEntrega)), nombre: f.nombre, descripcion: f.descripcion, activo: true })
    },
    async updateArea(id, f) {
      await wait()
      Object.assign(state.value.areas.find(a => a.idAreaEntrega === id) ?? {}, f)
    },
    async setAreaActive(id, a) {
      await wait()
      Object.assign(state.value.areas.find(x => x.idAreaEntrega === id) ?? {}, { activo: a })
    }
  }
}

export function useCatalogAdminService(): CatalogAdminService {
  return useRuntimeConfig().public.useMocks ? createMockCatalogAdminService() : createHttpCatalogAdminService(useApi())
}
