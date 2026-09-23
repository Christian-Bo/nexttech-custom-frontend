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
  /** Solo si el pago es en efectivo (para calcular el vuelto; la API no lo guarda aún). */
  montoRecibido?: number
  /** Foto de evidencia ya optimizada (máx. 2 MB). */
  foto: Blob
  observacion?: string
}

export interface FailedDeliveryRequest {
  resultado: Exclude<DeliveryResult, 'ENTREGADO'>
  observacion: string
  foto?: Blob
}

export interface DeliveryCapabilities {
  /** La API permite registrar "pago no realizado". */
  paymentFailure: boolean
}

/** Todas las operaciones usan el CÓDIGO de orden (ORD-XXXXXXXX), igual que la API. */
export interface DeliveryService {
  capabilities: DeliveryCapabilities
  /** Pedidos listos para tomar + los que este repartidor ya tomó. */
  listAssigned: () => Promise<DeliveryOrderDto[]>
  getOrder: (codigo: string) => Promise<DeliveryOrderDto>
  /** LISTO_PARA_ENTREGA -> EN_ENTREGA (toma la orden y abre IntentoEntrega). */
  startDelivery: (codigo: string) => Promise<DeliveryOrderDto>
  /** Valida el QR que muestra el comprador contra la orden. */
  validateOrderQr: (codigo: string, qr: string) => Promise<{ ok: boolean, message: string }>
  /** Busca una orden por QR escaneado o por código tecleado (enunciado 4.a). */
  findByQr: (qrOrCode: string) => Promise<DeliveryOrderDto | null>
  complete: (codigo: string, body: CompleteDeliveryRequest) => Promise<DeliveryOrderDto>
  reportFailed: (codigo: string, body: FailedDeliveryRequest) => Promise<DeliveryOrderDto>
}
