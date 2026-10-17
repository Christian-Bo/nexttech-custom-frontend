import type { OrderStatus } from '~/types/domain'

/** Orden en la cola de producción (OrdenColaDto del backend). */
export interface ProductionOrderDto {
  codigoOrden: string
  fechaCreacion: string
  total: number
  estado: OrderStatus
  areaEntrega: string
  nicknameComprador?: string
}

/** Lado de un artículo listo para imprimir (ZonaProduccionDto). */
export interface ProductionZone {
  idZona: number
  nombre: string
  idArchivoImagenFinal: number
  tipoMime: string
  /** Imagen final del lado en base64 (sin prefijo data:). */
  imagenBase64: string
}

export interface ProductionItem {
  nombreProducto: string
  nombreVariante: string
  cantidad: number
  atributosJson: string
  idPersonalizacion: number | null
  nfcUrl?: string | null
  nfcWriteUrl?: string | null
  zonas: ProductionZone[]
}

/** Detalle para impresión (GET /api/supervisor/orders/{codigo}). */
export interface ProductionDetail {
  codigoOrden: string
  fechaCreacion: string
  total: number
  estado: OrderStatus
  areaEntrega: string
  referenciaEntrega: string
  nicknameComprador: string
  nfcUrl?: string | null
  nfcWriteUrl?: string | null
  idArchivoConstancia: number | null
  items: ProductionItem[]
}

export interface ProductionService {
  listInProduction: () => Promise<ProductionOrderDto[]>
  listReady: () => Promise<ProductionOrderDto[]>
  /** EN_ELABORACION -> LISTO_PARA_ENTREGA */
  markReady: (codigo: string) => Promise<void>
  getDetail: (codigo: string) => Promise<ProductionDetail>
  /** Descarga el archivo final de un lado (o la constancia) para imprimir. */
  downloadFile: (codigo: string, idArchivo: number) => Promise<Blob>
  /** PDF real A4 (lado A/B), elaborado en backend. */
  printSelected: (codigos: string[]) => Promise<Blob>
  printQueue: () => Promise<Blob>
  reprint: (codigo: string) => Promise<Blob>
}
