/** Catálogo de la tienda. Contrato: CatalogController (GET /api/catalog/...). */

export interface ProductSummary {
  codigoProducto: string
  nombre: string
  descripcion: string | null
  categoria: string
  precioDesde: number
  permitePersonalizacion: boolean
}

export interface ProductAttribute {
  atributo: string
  valor: string
}

export interface ProductTemplateInfo {
  idZona: number
  forma: string
  anchoLienzo: number
  altoLienzo: number
}

export interface ProductVariant {
  idVariante: number
  codigoVariante: string
  nombre: string
  precioAdicional: number
  precioActual: number
  atributos: ProductAttribute[]
  plantillas: ProductTemplateInfo[]
}

export interface ProductZone {
  idZona: number
  nombre: string
  esObligatoria: boolean
  ordenVisual: number
}

export interface ProductMeasures {
  diametroLlaveroPulgadas: number
  diametroNfcPulgadas: number
  diametroLlaveroMm: number
  diametroNfcMm: number
  lienzoPx: number
  nfcLienzoPx: number
}

export interface ProductDetail {
  codigoProducto: string
  nombre: string
  descripcion: string | null
  categoria: string
  precioBase: number
  permitePersonalizacion: boolean
  medidas: ProductMeasures | null
  variantes: ProductVariant[]
  zonas: ProductZone[]
}

export interface DeliveryArea {
  idAreaEntrega: number
  nombre: string
  descripcion: string | null
}

export interface CatalogService {
  listProducts: () => Promise<ProductSummary[]>
  getProduct: (codigo: string) => Promise<ProductDetail>
  listDeliveryAreas: () => Promise<DeliveryArea[]>
}
