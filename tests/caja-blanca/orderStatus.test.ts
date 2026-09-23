import { describe, expect, it } from 'vitest'
import { paymentMethodFromName, paymentStatusFromName, statusFromName } from '~/utils/orderStatus'

/** Caja blanca: ramas de conversión nombre -> código de estado. */
describe('statusFromName (caja blanca)', () => {
  it.each([
    ['Orden generada', 'ORDEN_GENERADA'],
    ['En elaboracion', 'EN_ELABORACION'],
    ['En elaboración', 'EN_ELABORACION'],
    ['Listo para entrega', 'LISTO_PARA_ENTREGA'],
    ['  EN ENTREGA  ', 'EN_ENTREGA'],
    ['Entregado', 'ENTREGADO'],
    ['Comprador no encontrado', 'COMPRADOR_NO_ENCONTRADO'],
    ['LISTO_PARA_ENTREGA', 'LISTO_PARA_ENTREGA']
  ])('"%s" -> %s', (name, code) => {
    expect(statusFromName(name)).toBe(code)
  })

  it.each([null, undefined, '', 'Cancelado'])('valor vacío o desconocido (%s) -> null', (value) => {
    expect(statusFromName(value)).toBeNull()
  })
})

describe('pagos (caja blanca)', () => {
  it('método de pago', () => {
    expect(paymentMethodFromName('Efectivo')).toBe('EFECTIVO')
    expect(paymentMethodFromName('Tarjeta de crédito')).toBe('TARJETA')
    expect(paymentMethodFromName(null)).toBe('TARJETA')
  })

  it('estado de pago', () => {
    expect(paymentStatusFromName('Pagado')).toBe('PAGADO')
    expect(paymentStatusFromName('Rechazado')).toBe('RECHAZADO')
    expect(paymentStatusFromName('Pendiente')).toBe('PENDIENTE')
    expect(paymentStatusFromName(undefined)).toBe('PENDIENTE')
  })
})
