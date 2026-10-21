import { describe, expect, it } from 'vitest'
import {
  formatGtPhone,
  gtPhoneRule,
  isValidGtPhone,
  sanitizeGtInput,
  toBackendPhone,
  toLocalGtDigits
} from '~/utils/phone'

describe('Teléfonos de Guatemala: normalización a 8 dígitos', () => {
  it.each([
    ['55550101', '55550101'],
    ['50255550101', '55550101'],
    ['+502 5555-0101', '55550101'],
    ['502-5555-0101', '55550101'],
    ['  5555 0101  ', '55550101'],
    ['', ''],
    [null, ''],
    [undefined, '']
  ])('%s -> %s', (entrada, esperado) => {
    expect(toLocalGtDigits(entrada)).toBe(esperado)
  })
})

describe('Entrada del formulario: solo dígitos, máximo 8', () => {
  it.each([
    ['5555', '5555'],
    ['5555-0101', '55550101'],
    ['555501019999', '55550101'],
    ['abc5555def0101', '55550101'],
    ['', '']
  ])('%s -> %s', (entrada, esperado) => {
    expect(sanitizeGtInput(entrada)).toBe(esperado)
  })
})

describe('Validación', () => {
  it('acepta exactamente 8 dígitos', () => {
    expect(isValidGtPhone('55550101')).toBe(true)
  })

  it.each([
    ['menos de 8', '5555010'],
    ['más de 8', '555501019'],
    ['con el 502 adelante', '50255550101'],
    ['con letras', '5555010a'],
    ['vacío', '']
  ])('rechaza: %s', (_caso, valor) => {
    expect(isValidGtPhone(valor)).toBe(false)
  })

  it('la regla del formulario devuelve true o un mensaje', () => {
    expect(gtPhoneRule('55550101')).toBe(true)
    expect(typeof gtPhoneRule('123')).toBe('string')
  })
})

describe('Lo que se envía al backend', () => {
  it('siempre son los 8 dígitos nacionales, sin importar cómo se escribió', () => {
    expect(toBackendPhone('+502 5555-0101')).toBe('55550101')
    expect(toBackendPhone('50255550101')).toBe('55550101')
    expect(toBackendPhone('55550101')).toBe('55550101')
  })
})

describe('Presentación', () => {
  it('muestra el número con prefijo y separador', () => {
    expect(formatGtPhone('55550101')).toBe('+502 5555-0101')
    expect(formatGtPhone('50255550101')).toBe('+502 5555-0101')
  })

  it('devuelve el valor original si no es un número guatemalteco válido', () => {
    expect(formatGtPhone('123')).toBe('123')
  })
})
