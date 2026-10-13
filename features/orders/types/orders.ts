/**
 * Compra y pedidos del comprador.
 * Contrato: OrdersController (/api/checkout, /api/orders/my)
 * y PaymentsController (/api/payments/recurrente/confirm).
 */
import type { OrderStatus } from '~/types/domain'

export type PaymentMethod = 'EFECTIVO' | 'TARJETA'

export interface CheckoutRequest {
  idAreaEntrega: number
  referenciaEntrega: string
  metodoPago: PaymentMethod
}

/**
 * Orden ya creada en el backend.
 * Es lo que devuelve el checkout en efectivo y la confirmación del pago con tarjeta.
 */
export interface OrderCreated {
  kind: 'orden'
  codigoOrden: string
  total: number
  estado: OrderStatus
}

/**
 * Sesión de pago con tarjeta. Aquí el backend TODAVÍA no creó la orden:
 * hay que enviar al comprador a `checkoutUrl` y, cuando vuelva, confirmar con `confirmCard`.
 */
export interface CardCheckoutSession {
  kind: 'tarjeta'
  checkoutId: string
  checkoutUrl: string
  total: number
  moneda: string
  estado: string
}

/** Resultado del checkout: orden lista (efectivo) o sesión de pago pendiente (tarjeta). */
export type CheckoutOutcome = OrderCreated | CardCheckoutSession

export interface MyOrder {
  codigoOrden: string
  fechaCreacion: string
  total: number
  estado: OrderStatus
}

export interface OrdersService {
  checkout: (req: CheckoutRequest) => Promise<CheckoutOutcome>
  /**
   * Confirma el pago con tarjeta al volver del proveedor.
   * Es idempotente: si el webhook ya creó la orden, devuelve esa misma orden.
   */
  confirmCard: (checkoutId: string) => Promise<OrderCreated>
  myOrders: () => Promise<MyOrder[]>
  /** Métodos de pago que acepta el backend en este momento. */
  paymentMethods: PaymentMethod[]
}

/**
 * Guardamos el checkoutId antes de salir al proveedor de pago.
 * Es el respaldo para /compras/exito si el proveedor no devuelve el id en la URL.
 */
export const PENDING_CHECKOUT_KEY = 'nt-pending-checkout'

/** Guarda el checkoutId pendiente. Nunca falla: sin almacenamiento solo perdemos el respaldo. */
export function rememberPendingCheckout(checkoutId: string): void {
  try {
    localStorage.setItem(PENDING_CHECKOUT_KEY, checkoutId)
  }
  catch {
    // sin almacenamiento dependemos del parámetro de la URL
  }
}

/** Lee el checkoutId pendiente, o null si no hay. */
export function readPendingCheckout(): string | null {
  try {
    const value = localStorage.getItem(PENDING_CHECKOUT_KEY)
    return value && value.trim() ? value.trim() : null
  }
  catch {
    return null
  }
}

/** Borra el checkoutId pendiente una vez confirmado el pago. */
export function clearPendingCheckout(): void {
  try {
    localStorage.removeItem(PENDING_CHECKOUT_KEY)
  }
  catch {
    // nada que limpiar
  }
}