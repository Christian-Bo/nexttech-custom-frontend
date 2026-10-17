import { describe, expect, it, vi } from 'vitest'
import { createHttpOrdersService, mapCheckoutResponse } from '~/features/orders/services/ordersService'
import { isRecurrenteCheckoutSession } from '~/features/orders/types/orders'
import type { HttpClient } from '~/types/api'

describe('Checkout real: efectivo y tarjeta', () => {
  it('efectivo sigue creando orden, sin sesión Recurrente', () => {
    const result = mapCheckoutResponse('EFECTIVO', { codigoOrden: 'NT-100', fechaCreacion: '', total: 20, estado: 'ORDEN_GENERADA' })
    expect(isRecurrenteCheckoutSession(result)).toBe(false)
    expect(result).toMatchObject({ codigoOrden: 'NT-100', total: 20 })
  })

  it('tarjeta genera sesión sin inventar orden', () => {
    const session = { checkoutId: 'ch_abc', checkoutUrl: 'https://app.recurrente.com/checkout-session/ch_abc', url: 'https://app.recurrente.com/checkout-session/ch_abc', total: 20, moneda: 'GTQ' as const, estado: 'unpaid' }
    const result = mapCheckoutResponse('TARJETA', session)
    expect(isRecurrenteCheckoutSession(result)).toBe(true)
    expect(result).not.toHaveProperty('codigoOrden')
  })

  it('rechaza respuesta inválida de tarjeta', () => {
    expect(() => mapCheckoutResponse('TARJETA', { codigoOrden: 'N', fechaCreacion: '', total: 20, estado: 'ORDEN_GENERADA' })).toThrow()
  })

  it('confirm envía solo checkoutId al backend', async () => {
    const api = vi.fn(async () => ({ codigoOrden: 'NT-101', fechaCreacion: '', total: 20, estado: 'ORDEN_GENERADA' })) as unknown as HttpClient
    const service = createHttpOrdersService(api)
    const order = await service.confirmCard('ch_abc')
    expect(api).toHaveBeenCalledWith('/api/payments/recurrente/confirm', expect.objectContaining({ method: 'POST', body: { checkoutId: 'ch_abc' } }))
    expect(order.codigoOrden).toBe('NT-101')
  })
})
