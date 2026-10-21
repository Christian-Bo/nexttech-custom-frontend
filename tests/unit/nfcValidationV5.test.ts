import { describe, expect, it } from 'vitest'
import {
  NFC_INSECURE_MESSAGE,
  NFC_LONG_MESSAGE,
  NFC_REQUIRED_MESSAGE,
  normalizeNfcCustomerUrl,
  validateNfcCustomerUrl
} from '~/features/personalization/services/nfcValidation'

describe('URL NFC del comprador, contrato V5', () => {
  it('exige HTTPS sin credenciales', () => {
    expect(validateNfcCustomerUrl('')).toBe(NFC_REQUIRED_MESSAGE)
    expect(validateNfcCustomerUrl('https://user:pass@example.com/')).toBe(NFC_REQUIRED_MESSAGE)
    expect(validateNfcCustomerUrl('javascript:alert(1)')).toBe(NFC_REQUIRED_MESSAGE)
    expect(validateNfcCustomerUrl('https://open.spotify.com/playlist/123')).toBeNull()
  })

  it('rechaza http explícito con un mensaje que dice cómo arreglarlo', () => {
    expect(validateNfcCustomerUrl('http://open.spotify.com/a')).toBe(NFC_INSECURE_MESSAGE)
  })

  it('rechaza URLs demasiado largas con el texto del backend', () => {
    expect(validateNfcCustomerUrl(`https://example.com/${'a'.repeat(2049)}`)).toBe(NFC_LONG_MESSAGE)
  })
})

describe('Completar el protocolo como la barra del navegador', () => {
  it.each([
    ['www.google.com', 'https://www.google.com'],
    ['google.com', 'https://google.com'],
    ['open.spotify.com/playlist/123', 'https://open.spotify.com/playlist/123'],
    ['  www.google.com  ', 'https://www.google.com'],
    ['', '']
  ])('%s -> %s', (entrada, esperado) => {
    expect(normalizeNfcCustomerUrl(entrada)).toBe(esperado)
  })

  it.each([
    ['https://ejemplo.com'],
    ['http://ejemplo.com'],
    ['javascript:alert(1)'],
    ['mailto:alguien@ejemplo.com']
  ])('no toca lo que ya trae esquema: %s', (entrada) => {
    expect(normalizeNfcCustomerUrl(entrada)).toBe(entrada)
  })

  it('acepta un dominio escrito sin protocolo, que era lo que fallaba', () => {
    expect(validateNfcCustomerUrl('www.google.com')).toBeNull()
    expect(validateNfcCustomerUrl('google.com')).toBeNull()
  })
})
