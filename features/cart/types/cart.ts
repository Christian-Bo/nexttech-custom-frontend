/** Carrito del comprador. Contrato: CartController (/api/cart). */

export interface CartItem {
  idDetalleCarrito: number
  idVariante: number
  nombreProducto: string
  nombreVariante: string
  idPersonalizacion: number | null
  cantidad: number
  precioUnitario: number
  subtotal: number
}

export interface Cart {
  idCarrito: number
  estado: string
  total: number
  items: CartItem[]
}

export interface AddCartItemRequest {
  idVariante: number
  cantidad: number
  idPersonalizacion?: number | null
}

export interface CartService {
  get: () => Promise<Cart>
  add: (req: AddCartItemRequest) => Promise<Cart>
  setQuantity: (idDetalleCarrito: number, cantidad: number) => Promise<Cart>
  remove: (idDetalleCarrito: number) => Promise<Cart>
}

export const MAX_ITEM_QUANTITY = 20
