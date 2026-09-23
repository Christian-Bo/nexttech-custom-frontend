import { describe, expect, it } from 'vitest'
import { credentialFileName } from '~/features/photo-studio/utils/credentialPdf'
import { isFaceVerificationApproved } from '~/services/faceService'
import type { FaceVerifyResultDto } from '~/types/auth'

describe('Nombre del PDF de la credencial (caja negra)', () => {
  it.each([
    ['Sergio', 'credencial-nexttech-sergio.pdf'],
    ['José Peña', 'credencial-nexttech-jose-pena.pdf'],
    ['  ##  ', 'credencial-nexttech.pdf'],
    ['', 'credencial-nexttech.pdf']
  ])('"%s" -> %s', (nickname, expected) => {
    expect(credentialFileName(nickname)).toBe(expected)
  })
})

describe('Verificación facial aprobada (caja negra, contrato /api/face/verify)', () => {
  const base = { authenticationPassed: true, isLive: true, isMatch: true } as FaceVerifyResultDto

  it('solo se aprueba si pasa autenticación, prueba de vida e identidad', () => {
    expect(isFaceVerificationApproved(base)).toBe(true)
  })

  it.each([
    ['autenticación fallida', { authenticationPassed: false }],
    ['no es una persona real (liveness)', { isLive: false }],
    ['no coincide el rostro', { isMatch: false }],
    ['sin resultado de identidad (null)', { isMatch: null }]
  ])('rechaza: %s', (_caso, cambio) => {
    expect(isFaceVerificationApproved({ ...base, ...cambio } as FaceVerifyResultDto)).toBe(false)
  })
})
