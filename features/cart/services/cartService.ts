import type { AddCartItemRequest, Cart, CartService } from '../types/cart'
import { MAX_ITEM_QUANTITY } from '../types/cart'
import { findMockVariant } from '~/features/catalog/services/mockCatalog'
import { useApi } from '~/services/api'
import type { ApiError, HttpClient } from '~/types/api'

const MOCK_KEY = 'nt-mock-cart'

function emptyCart(): Cart {
  return { idCarrito: 1, estado: 'Activo', total: 0, items: [] }
}

function recalc(cart: Cart): Cart {
  for (const item of cart.items) item.subtotal = Math.round(item.precioUnitario * item.cantidad * 100) / 100
  cart.total = Math.round(cart.items.reduce((s, i) => s + i.subtotal, 0) * 100) / 100
  return cart
}

function readMock(): Cart {
  if (!import.meta.client) return emptyCart()
  try {
    const raw = localStorage.getItem(MOCK_KEY)
    return raw ? recalc(JSON.parse(raw) as Cart) : emptyCart()
  }
  catch {
    return emptyCart()
  }
}

function writeMock(cart: Cart): Cart {
  try {
    localStorage.setItem(MOCK_KEY, JSON.stringify(cart))
  }
  catch {
    // Sin almacenamiento el carrito dura solo esta visita.
  }
  return structuredClone(cart)
}

function badRequest(message: string): ApiError {
  return { status: 400, code: 'BAD_REQUEST', message }
}

/** Carrito de demostración en el navegador (mismas reglas que el backend). */
export function createMockCartService(): CartService {
  return {
    async get() {
      return readMock()
    },
    async add(req: AddCartItemRequest) {
      const found = findMockVariant(req.idVariante)
      if (!found) throw { status: 404, code: 'NOT_FOUND', message: 'El producto ya no está disponible.' } satisfies ApiError
      if (req.cantidad < 1 || req.cantidad > MAX_ITEM_QUANTITY) throw badRequest(`La cantidad debe estar entre 1 y ${MAX_ITEM_QUANTITY}.`)
      const cart = readMock()
      const nextId = Math.max(0, ...cart.items.map(i => i.idDetalleCarrito)) + 1
      cart.items.push({
        idDetalleCarrito: nextId,
        idVariante: req.idVariante,
        nombreProducto: found.product.nombre,
        nombreVariante: found.variant.nombre,
        idPersonalizacion: req.idPersonalizacion ?? null,
        cantidad: req.cantidad,
        precioUnitario: found.variant.precioActual,
        subtotal: 0
      })
      return writeMock(recalc(cart))
    },
    async setQuantity(id, cantidad) {
      if (cantidad < 1 || cantidad > MAX_ITEM_QUANTITY) throw badRequest(`La cantidad debe estar entre 1 y ${MAX_ITEM_QUANTITY}.`)
      const cart = readMock()
      const item = cart.items.find(i => i.idDetalleCarrito === id)
      if (item) item.cantidad = cantidad
      return writeMock(recalc(cart))
    },
    async remove(id) {
      const cart = readMock()
      cart.items = cart.items.filter(i => i.idDetalleCarrito !== id)
      return writeMock(recalc(cart))
    }
  }
}

export function clearMockCart(): void {
  try {
    localStorage.removeItem(MOCK_KEY)
  }
  catch {
    // nada que limpiar
  }
}

function normalize(cart: Cart): Cart {
  return { ...cart, items: cart.items ?? [] }
}

export function createHttpCartService(api: HttpClient): CartService {
  return {
    get: async () => normalize(await api<Cart>('/api/cart')),
    add: async req => normalize(await api<Cart>('/api/cart/items', {
      method: 'POST',
      body: { idVariante: req.idVariante, cantidad: req.cantidad, idPersonalizacion: req.idPersonalizacion ?? null }
    })),
    setQuantity: async (id, cantidad) => normalize(await api<Cart>(`/api/cart/items/${id}`, { method: 'PATCH', body: { cantidad } })),
    remove: async id => normalize(await api<Cart>(`/api/cart/items/${id}`, { method: 'DELETE' }))
  }
}

export function useCartService(): CartService {
  return useRuntimeConfig().public.useMocks ? createMockCartService() : createHttpCartService(useApi())
}
