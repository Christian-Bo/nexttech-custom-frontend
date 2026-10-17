/** Compra y pedidos del comprador. Contrato: OrdersController (/api/checkout, /api/orders/my). */
import type { OrderStatus } from '~/types/domain'

/** Métodos aceptados por /api/checkout. */
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

/** 200 de POST /api/checkout cuando metodoPago = TARJETA. Aún no existe una orden. */
export interface RecurrenteCheckoutSession {
  checkoutId: string
  checkoutUrl: string
  url: string
  total: number
  moneda: 'GTQ'
  estado: string
}

export type CheckoutResponse = CheckoutResult | RecurrenteCheckoutSession

export function isRecurrenteCheckoutSession(value: CheckoutResponse): value is RecurrenteCheckoutSession {
  return 'checkoutId' in value && 'checkoutUrl' in value
}

export interface MyOrder {
  codigoOrden: string
  fechaCreacion: string
  total: number
  estado: OrderStatus
}

export interface OrdersService {
  checkout: (req: CheckoutRequest) => Promise<CheckoutResponse>
  confirmCard: (checkoutId: string) => Promise<CheckoutResult>
  myOrders: () => Promise<MyOrder[]>
  /** Métodos de pago disponibles en el checkout. */
  paymentMethods: PaymentMethod[]
}
