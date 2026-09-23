import { describe, expect, it } from 'vitest'
import { extractOrderCode } from '~/utils/orderStatus'

/**
 * Caja negra (enunciado 4.a): el repartidor busca el pedido tecleando o escaneando el QR.
 * Clases de equivalencia sobre la ENTRADA, sin mirar la implementación.
 */
describe('Búsqueda de pedido por código o QR (caja negra)', () => {
  it.each([
    ['código exacto', 'ORD-1A2B3C4D', 'ORD-1A2B3C4D'],
    ['minúsculas sin guion', 'ord1a2b3c4d', 'ORD-1A2B3C4D'],
    ['con espacios alrededor', '   ORD-1A2B3C4D  ', 'ORD-1A2B3C4D'],
    ['contenido del QR con prefijo NT-', 'NT-ORD-1A2B3C4D', 'ORD-1A2B3C4D'],
    ['URL que contiene el código', 'https://nexttech.app/seguimiento/ORD-1A2B3C4D?x=1', 'ORD-1A2B3C4D'],
    ['código demo NTC', 'ntc-1045', 'NTC-1045'],
    ['QR demo NT-NTC', 'NT-NTC-1042', 'NTC-1042']
  ])('%s: "%s" -> %s', (_caso, input, expected) => {
    expect(extractOrderCode(input)).toBe(expected)
  })

  it('valor límite: 3 dígitos hexadecimales es válido', () => {
    expect(extractOrderCode('ORD-ABC')).toBe('ORD-ABC')
  })

  it('clase inválida: texto sin código se devuelve normalizado (el backend responde 404)', () => {
    expect(extractOrderCode('hola')).toBe('HOLA')
    expect(extractOrderCode('NT-XYZ')).toBe('XYZ')
  })
})
