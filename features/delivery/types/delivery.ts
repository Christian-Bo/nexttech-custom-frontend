/**
 * Entrega (repartidor). PROVISIONAL: nombres alineados al modelo SQL Server
 * (Orden, DetalleOrden, Pago, IntentoEntrega, ResultadoEntrega, AreaEntrega).
 * Reconciliar con Swagger cuando Integrante 3 publique los endpoints.
 */
import type { OrderStatus } from '~/types/domain'

export type PaymentMethod = 'EFECTIVO' | 'TARJETA'
export type PaymentStatus = 'PENDIENTE' | 'PAGADO' | 'RECHAZADO'
export type DeliveryResult = 'ENTREGADO' | 'COMPRADOR_NO_ENCONTRADO' | 'PAGO_NO_REALIZADO'

export interface DeliveryOrderItemDto {
  idDetalleOrden: number
  nombreProducto: string
  nombreVariante: string
  cantidad: number
  subtotal: number
  personalizado: boolean
}

export interface DeliveryPaymentDto {
  metodo: PaymentMethod
  estado: PaymentStatus
  monto: number
}

export interface DeliveryAttemptDto {
  resultado: DeliveryResult
  fechaHoraFin: string
  observacion?: string | null
  fotoFileId?: string | null
}

export interface DeliveryOrderDto {
  idOrden: number
  codigoOrden: string
  nicknameComprador: string
  telefonoComprador?: string | null
  areaEntrega: string
  referenciaEntrega: string
  estado: OrderStatus
  total: number
  pago: DeliveryPaymentDto
  items: DeliveryOrderItemDto[]
  fechaCreacion: string
  qrUtilizado: boolean
  ultimoIntento?: DeliveryAttemptDto | null
}

export interface CompleteDeliveryRequest {
  /** Solo si el pago es en efectivo. */
  montoRecibido?: number
  fotoFileId: string
  observacion?: string
}

export interface FailedDeliveryRequest {
  resultado: Exclude<DeliveryResult, 'ENTREGADO'>
  observacion: string
  fotoFileId?: string
}

export interface DeliveryService {
  listAssigned: () => Promise<DeliveryOrderDto[]>
  getOrder: (idOrden: number) => Promise<DeliveryOrderDto>
  /** LISTO_PARA_ENTREGA -> EN_ENTREGA (abre IntentoEntrega). */
  startDelivery: (idOrden: number) => Promise<DeliveryOrderDto>
  /** Valida el QR que muestra el comprador contra la orden. */
  validateOrderQr: (idOrden: number, qr: string) => Promise<{ ok: boolean, message: string }>
  /** Busca la orden asignada a la que pertenece un QR (escaneo rápido). */
  findByQr: (qr: string) => Promise<DeliveryOrderDto | null>
  complete: (idOrden: number, body: CompleteDeliveryRequest) => Promise<DeliveryOrderDto>
  reportFailed: (idOrden: number, body: FailedDeliveryRequest) => Promise<DeliveryOrderDto>
}
