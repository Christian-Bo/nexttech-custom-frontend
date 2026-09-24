/** Parametrización del catálogo (solo ADMIN). Contrato: AdminCatalogController (/api/admin/catalog). */

export type CanvasShape = 'CIRCULAR' | 'CUADRADA'

export interface AdminCategory {
  idCategoria: number
  nombre: string
  descripcion: string | null
  activo: boolean
}

export interface AdminProductSummary {
  idProducto: number
  codigoProducto: string
  nombre: string
  categoria: string
  precioBase: number
  permitePersonalizacion: boolean
  activo: boolean
  variantesActivas: number
}

export interface AdminVariant {
  idVariante: number
  codigoVariante: string
  nombre: string
  descripcion: string | null
  precioAdicional: number
  precioActual: number
  activo: boolean
  formaLienzo: CanvasShape | null
}

export interface AdminProductDetail {
  idProducto: number
  idCategoria: number
  codigoProducto: string
  nombre: string
  descripcion: string | null
  categoria: string
  precioBase: number
  permitePersonalizacion: boolean
  activo: boolean
  zonas: { idZona: number, nombre: string, esObligatoria: boolean, ordenVisual: number }[]
  variantes: AdminVariant[]
}

export interface AdminArea {
  idAreaEntrega: number
  nombre: string
  descripcion: string | null
  activo: boolean
}

export interface ProductForm {
  idCategoria: number
  codigoProducto: string
  nombre: string
  descripcion: string | null
  precioBase: number
  permitePersonalizacion: boolean
}

export interface VariantForm {
  codigoVariante: string
  nombre: string
  descripcion: string | null
  precioAdicional: number
  formaLienzo: CanvasShape | null
}

export interface NamedForm {
  nombre: string
  descripcion: string | null
}

export interface CatalogAdminService {
  categories: () => Promise<AdminCategory[]>
  createCategory: (f: NamedForm) => Promise<unknown>
  updateCategory: (id: number, f: NamedForm) => Promise<unknown>
  setCategoryActive: (id: number, active: boolean) => Promise<unknown>

  products: () => Promise<AdminProductSummary[]>
  product: (codigo: string) => Promise<AdminProductDetail>
  createProduct: (f: ProductForm) => Promise<unknown>
  updateProduct: (codigo: string, f: Omit<ProductForm, 'codigoProducto'>) => Promise<unknown>
  setProductActive: (codigo: string, active: boolean) => Promise<unknown>

  createVariant: (codigoProducto: string, f: VariantForm) => Promise<unknown>
  updateVariant: (id: number, f: Omit<VariantForm, 'codigoVariante'>) => Promise<unknown>
  setVariantActive: (id: number, active: boolean) => Promise<unknown>

  areas: () => Promise<AdminArea[]>
  createArea: (f: NamedForm) => Promise<unknown>
  updateArea: (id: number, f: NamedForm) => Promise<unknown>
  setAreaActive: (id: number, active: boolean) => Promise<unknown>
}
