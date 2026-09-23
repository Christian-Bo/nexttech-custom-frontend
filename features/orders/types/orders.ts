/** Compra y pedidos del comprador. Contrato: OrdersController (/api/checkout, /api/orders/my). */
import type { OrderStatus } from '~/types/domain'

/** Por ahora el backend solo acepta EFECTIVO; TARJETA la integra el módulo de pagos. */
export type PaymentMethod = 'EFECTIVO' | 'TARJETA'

export interface CheckoutRequest {
  idAreaEntrega: number
  referenciaEntrega: string
  metodoPago: PaymentMethod
}

export interface CheckoutResult {
  codigoOrden: string
  total: number
  estado: OrderStatus
}

export interface MyOrder {
  codigoOrden: string
  fechaCreacion: string
  total: number
  estado: OrderStatus
}

export interface OrdersService {
  checkout: (req: CheckoutRequest) => Promise<CheckoutResult>
  myOrders: () => Promise<MyOrder[]>
  /** Métodos de pago que acepta el backend en este momento. */
  paymentMethods: PaymentMethod[]
}
