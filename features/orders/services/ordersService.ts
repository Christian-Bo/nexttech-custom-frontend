import type {
  CheckoutOutcome,
  CheckoutRequest,
  MyOrder,
  OrderCreated,
  OrdersService,
  PaymentMethod
} from '../types/orders'
import { clearPendingCheckout } from '../types/orders'
import type { Cart } from '~/features/cart/types/cart'
import { MOCK_DELIVERY_AREAS } from '~/features/catalog/services/mockCatalog'
import { clearMockCart, createMockCartService } from '~/features/cart/services/cartService'
import { useMockOrders } from '~/services/mock/mockOrders'
import { useApi } from '~/services/api'
import type { ApiError, HttpClient } from '~/types/api'
import { statusFromName } from '~/utils/orderStatus'

const MY_ORDERS_KEY = 'nt-mock-my-orders'
const MOCK_PENDING_KEY = 'nt-mock-pending-checkout'

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

function readMyCodes(): string[] {
  try {
    return JSON.parse(localStorage.getItem(MY_ORDERS_KEY) ?? '[]') as string[]
  }
  catch {
    return []
  }
}

function rememberCode(code: string): void {
  try {
    localStorage.setItem(MY_ORDERS_KEY, JSON.stringify([code, ...readMyCodes()].slice(0, 30)))
  }
  catch {
    // opcional
  }
}

function badRequest(message: string): ApiError {
  return { status: 400, code: 'BAD_REQUEST', message }
}

function notFound(message: string): ApiError {
  return { status: 404, code: 'NOT_FOUND', message }
}

/* ------------------------------------------------------------------ */
/* Demostración                                                        */
/* ------------------------------------------------------------------ */

/** Pago con tarjeta pendiente en modo demostración. */
interface MockPendingCheckout {
  checkoutId: string
  idAreaEntrega: number
  referenciaEntrega: string
  total: number
}

function readMockPending(): MockPendingCheckout | null {
  try {
    const raw = localStorage.getItem(MOCK_PENDING_KEY)
    return raw ? JSON.parse(raw) as MockPendingCheckout : null
  }
  catch {
    return null
  }
}

function writeMockPending(value: MockPendingCheckout): void {
  try {
    localStorage.setItem(MOCK_PENDING_KEY, JSON.stringify(value))
  }
  catch {
    // opcional
  }
}

function clearMockPending(): void {
  try {
    localStorage.removeItem(MOCK_PENDING_KEY)
  }
  catch {
    // nada que limpiar
  }
}

/** Compra de demostración: crea la orden en el simulador para verla en seguimiento y dashboard. */
export function createMockOrdersService(): OrdersService {
  const mock = useMockOrders()

  function areaName(idAreaEntrega: number): string {
    const area = MOCK_DELIVERY_AREAS.find(a => a.idAreaEntrega === idAreaEntrega)
    if (!area) throw notFound('El área de entrega no está disponible.')
    return area.nombre
  }

  function placeOrder(
    cart: Cart,
    areaEntrega: string,
    referenciaEntrega: string,
    metodoPago: PaymentMethod
  ): OrderCreated {
    const codigoOrden = mock.createOrder({
      nickname: useAuthStore().nickname ?? 'comprador_demo',
      producto: cart.items.map(i => `${i.nombreProducto} ${i.nombreVariante}`).join(', '),
      cantidad: cart.items.reduce((n, i) => n + i.cantidad, 0),
      total: cart.total,
      metodoPago,
      areaEntrega,
      referenciaEntrega
    })
    rememberCode(codigoOrden)
    clearMockCart()
    return { kind: 'orden', codigoOrden, total: cart.total, estado: 'ORDEN_GENERADA' }
  }

  return {
    paymentMethods: ['EFECTIVO', 'TARJETA'],

    async checkout(req: CheckoutRequest): Promise<CheckoutOutcome> {
      await delay(600)
      const referencia = req.referenciaEntrega.trim()
      if (!referencia) throw badRequest('La referencia de entrega es obligatoria.')
      const nombreArea = areaName(req.idAreaEntrega)
      const cart = await createMockCartService().get()
      if (cart.items.length === 0) throw badRequest('El carrito está vacío.')

      if (req.metodoPago === 'TARJETA') {
        // En demostración el "proveedor de pago" es nuestra propia página de retorno,
        // así se recorre el mismo flujo que con Recurrente sin cobrar nada.
        const checkoutId = `NT-DEMO-${Date.now().toString(36).toUpperCase()}`
        writeMockPending({ checkoutId, idAreaEntrega: req.idAreaEntrega, referenciaEntrega: referencia, total: cart.total })
        return {
          kind: 'tarjeta',
          checkoutId,
          checkoutUrl: `/compras/exito?checkout_id=${encodeURIComponent(checkoutId)}`,
          total: cart.total,
          moneda: 'GTQ',
          estado: 'pending'
        }
      }

      return placeOrder(cart, nombreArea, referencia, 'EFECTIVO')
    },

    async confirmCard(checkoutId: string): Promise<OrderCreated> {
      await delay(900)
      const pending = readMockPending()
      if (!pending || pending.checkoutId !== checkoutId) {
        throw notFound('No encontramos ese pago. Revisa tus pedidos.')
      }
      const cart = await createMockCartService().get()
      if (cart.items.length === 0) throw badRequest('Ese carrito ya fue procesado.')
      const orden = placeOrder(cart, areaName(pending.idAreaEntrega), pending.referenciaEntrega, 'TARJETA')
      clearMockPending()
      clearPendingCheckout()
      return orden
    },

    async myOrders(): Promise<MyOrder[]> {
      await delay(300)
      const codes = readMyCodes()
      return mock.orders.value
        .filter(o => codes.includes(o.codigoOrden))
        .map(o => ({ codigoOrden: o.codigoOrden, fechaCreacion: o.fechaCreacion, total: o.total, estado: o.estado }))
        .sort((a, b) => b.fechaCreacion.localeCompare(a.fechaCreacion))
    }
  }
}

/* ------------------------------------------------------------------ */
/* API real                                                            */
/* ------------------------------------------------------------------ */

/** Respuesta de /api/checkout con EFECTIVO y de /api/payments/recurrente/confirm. */
interface OrdenApi {
  codigoOrden: string
  fechaCreacion: string
  total: number
  estado: string
}

/** Respuesta de /api/checkout con TARJETA (CheckoutTarjetaDto). */
interface CheckoutTarjetaApi {
  checkoutId: string
  checkoutUrl?: string | null
  /** El DTO del backend expone el mismo valor también como `url`. */
  url?: string | null
  total: number
  moneda?: string | null
  estado?: string | null
}

function toOrderCreated(o: OrdenApi): OrderCreated {
  return {
    kind: 'orden',
    codigoOrden: o.codigoOrden,
    total: o.total,
    estado: statusFromName(o.estado) ?? 'ORDEN_GENERADA'
  }
}

export function createHttpOrdersService(api: HttpClient): OrdersService {
  return {
    paymentMethods: ['EFECTIVO', 'TARJETA'],

    async checkout(req: CheckoutRequest): Promise<CheckoutOutcome> {
      const body = {
        idAreaEntrega: req.idAreaEntrega,
        referenciaEntrega: req.referenciaEntrega.trim(),
        metodoPago: req.metodoPago
      }

      if (req.metodoPago === 'TARJETA') {
        const session = await api<CheckoutTarjetaApi>('/api/checkout', { method: 'POST', body, timeout: 30_000 })
        const checkoutUrl = (session.checkoutUrl ?? session.url ?? '').trim()
        if (!checkoutUrl || !session.checkoutId) {
          throw {
            status: 502,
            code: 'BAD_GATEWAY',
            message: 'El cobro con tarjeta no devolvió un enlace de pago. Intenta de nuevo o paga en efectivo.'
          } satisfies ApiError
        }
        return {
          kind: 'tarjeta',
          checkoutId: session.checkoutId,
          checkoutUrl,
          total: session.total,
          moneda: session.moneda ?? 'GTQ',
          estado: session.estado ?? 'pending'
        }
      }

      return toOrderCreated(await api<OrdenApi>('/api/checkout', { method: 'POST', body }))
    },

    async confirmCard(checkoutId: string): Promise<OrderCreated> {
      const orden = await api<OrdenApi>('/api/payments/recurrente/confirm', {
        method: 'POST',
        body: { checkoutId },
        timeout: 30_000
      })
      clearPendingCheckout()
      return toOrderCreated(orden)
    },

    async myOrders(): Promise<MyOrder[]> {
      const list = await api<OrdenApi[]>('/api/orders/my')
      return list
        .map(o => ({
          codigoOrden: o.codigoOrden,
          fechaCreacion: o.fechaCreacion,
          total: o.total,
          estado: statusFromName(o.estado) ?? 'ORDEN_GENERADA'
        }) satisfies MyOrder)
        .sort((a, b) => b.fechaCreacion.localeCompare(a.fechaCreacion))
    }
  }
}

export function useOrdersService(): OrdersService {
  return useRuntimeConfig().public.useMocks ? createMockOrdersService() : createHttpOrdersService(useApi())
}