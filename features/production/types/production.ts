import type { OrderStatus } from '~/types/domain'

/** Orden en la cola de producción (OrdenColaDto del backend). */
export interface ProductionOrderDto {
  codigoOrden: string
  fechaCreacion: string
  total: number
  estado: OrderStatus
  areaEntrega: string
}

export interface ProductionService {
  listInProduction: () => Promise<ProductionOrderDto[]>
  listReady: () => Promise<ProductionOrderDto[]>
  /** EN_ELABORACION -> LISTO_PARA_ENTREGA */
  markReady: (codigo: string) => Promise<void>
}
