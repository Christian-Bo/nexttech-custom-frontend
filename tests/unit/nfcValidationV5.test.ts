import { describe, expect, it } from 'vitest'
import { NFC_LONG_MESSAGE, NFC_REQUIRED_MESSAGE, validateNfcCustomerUrl } from '~/features/personalization/services/nfcValidation'

describe('URL NFC del comprador, contrato V5', () => {
  it('exige HTTPS sin credenciales', () => {
    expect(validateNfcCustomerUrl('')).toBe(NFC_REQUIRED_MESSAGE)
    expect(validateNfcCustomerUrl('http://open.spotify.com/a')).toBe(NFC_REQUIRED_MESSAGE)
    expect(validateNfcCustomerUrl('https://user:pass@example.com/')).toBe(NFC_REQUIRED_MESSAGE)
    expect(validateNfcCustomerUrl('javascript:alert(1)')).toBe(NFC_REQUIRED_MESSAGE)
    expect(validateNfcCustomerUrl('https://open.spotify.com/playlist/123')).toBeNull()
  })
  it('rechaza URLs demasiado largas con el texto del backend', () => {
    expect(validateNfcCustomerUrl(`https://example.com/${'a'.repeat(2049)}`)).toBe(NFC_LONG_MESSAGE)
  })
})
