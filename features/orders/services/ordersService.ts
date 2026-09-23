import type { CheckoutResult, MyOrder, OrdersService } from '../types/orders'
import { MOCK_DELIVERY_AREAS } from '~/features/catalog/services/mockCatalog'
import { clearMockCart, createMockCartService } from '~/features/cart/services/cartService'
import { useMockOrders } from '~/services/mock/mockOrders'
import { useApi } from '~/services/api'
import type { ApiError, HttpClient } from '~/types/api'
import { statusFromName } from '~/utils/orderStatus'

const MY_ORDERS_KEY = 'nt-mock-my-orders'

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

/** Compra de demostración: crea la orden en el simulador para verla en seguimiento y dashboard. */
export function createMockOrdersService(): OrdersService {
  const mock = useMockOrders()
  return {
    paymentMethods: ['EFECTIVO', 'TARJETA'],
    async checkout(req) {
      await new Promise(r => setTimeout(r, 600))
      if (!req.referenciaEntrega.trim()) throw badRequest('La referencia de entrega es obligatoria.')
      const area = MOCK_DELIVERY_AREAS.find(a => a.idAreaEntrega === req.idAreaEntrega)
      if (!area) throw { status: 404, code: 'NOT_FOUND', message: 'El área de entrega no está disponible.' } satisfies ApiError
      const cart = await createMockCartService().get()
      if (cart.items.length === 0) throw badRequest('El carrito está vacío.')
      const codigo = mock.createOrder({
        nickname: useAuthStore().nickname ?? 'comprador_demo',
        producto: cart.items.map(i => `${i.nombreProducto} ${i.nombreVariante}`).join(', '),
        cantidad: cart.items.reduce((n, i) => n + i.cantidad, 0),
        total: cart.total,
        metodoPago: req.metodoPago,
        areaEntrega: area.nombre,
        referenciaEntrega: req.referenciaEntrega.trim()
      })
      rememberCode(codigo)
      clearMockCart()
      return { codigoOrden: codigo, total: cart.total, estado: 'ORDEN_GENERADA' }
    },
    async myOrders() {
      await new Promise(r => setTimeout(r, 300))
      const codes = readMyCodes()
      return mock.orders.value
        .filter(o => codes.includes(o.codigoOrden))
        .map(o => ({ codigoOrden: o.codigoOrden, fechaCreacion: o.fechaCreacion, total: o.total, estado: o.estado }))
        .sort((a, b) => b.fechaCreacion.localeCompare(a.fechaCreacion))
    }
  }
}

interface OrdenApi { codigoOrden: string, fechaCreacion: string, total: number, estado: string }

export function createHttpOrdersService(api: HttpClient): OrdersService {
  return {
    paymentMethods: ['EFECTIVO'],
    async checkout(req) {
      const o = await api<OrdenApi>('/api/checkout', {
        method: 'POST',
        body: { idAreaEntrega: req.idAreaEntrega, referenciaEntrega: req.referenciaEntrega.trim(), metodoPago: req.metodoPago }
      })
      return { codigoOrden: o.codigoOrden, total: o.total, estado: statusFromName(o.estado) ?? 'ORDEN_GENERADA' } satisfies CheckoutResult
    },
    async myOrders() {
      const list = await api<OrdenApi[]>('/api/orders/my')
      return list
        .map(o => ({ ...o, estado: statusFromName(o.estado) ?? 'ORDEN_GENERADA' }) satisfies MyOrder)
        .sort((a, b) => b.fechaCreacion.localeCompare(a.fechaCreacion))
    }
  }
}

export function useOrdersService(): OrdersService {
  return useRuntimeConfig().public.useMocks ? createMockOrdersService() : createHttpOrdersService(useApi())
}
