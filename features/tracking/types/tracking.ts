/** Seguimiento del pedido (vista del comprador). PROVISIONAL hasta el endpoint real. */
import type { OrderStatus } from '~/types/domain'

export interface TrackingStepDto {
  estado: OrderStatus
  fechaHora: string
  observacion?: string | null
}

export interface OrderTrackingDto {
  idOrden: number
  codigoOrden: string
  estado: OrderStatus
  producto: string
  cantidad: number
  total: number
  metodoPago: 'EFECTIVO' | 'TARJETA'
  areaEntrega: string
  referenciaEntrega: string
  fechaCreacion: string
  historial: TrackingStepDto[]
  /** Contenido del QR que el comprador muestra al repartidor (solo cuando aplica). */
  qrEntrega: string | null
}

export interface TrackingService {
  getByCode: (codigoOrden: string) => Promise<OrderTrackingDto>
}
