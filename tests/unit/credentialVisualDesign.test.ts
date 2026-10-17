import { describe, expect, it } from 'vitest'
import {
  defaultVisualCredentialDesign,
  normalizeVisualCredentialDesign,
  visualCredentialStorageKey,
  VISUAL_CREDENTIAL_MAX_STICKERS
} from '~/utils/credentialVisualDesign'

describe('Credencial visual local - contrato independiente del backend V4', () => {
  it('parte de un tema azul sin stickers y nunca incluye datos de identidad', () => {
    const design = defaultVisualCredentialDesign()
    expect(design).toEqual({ version: 1, theme: 'BLUE_NEON', stickers: [] })
    expect(JSON.stringify(design)).not.toMatch(/(accessToken|jwt|portrait|photo|qrCredential|password)/i)
  })
  it('separa el almacenamiento entre compradores', () => {
    expect(visualCredentialStorageKey(182)).toBe('nexttech:credential-visual:v1:buyer:182')
    expect(visualCredentialStorageKey(183)).not.toBe(visualCredentialStorageKey(182))
    expect(visualCredentialStorageKey(null)).toBeNull()
    expect(visualCredentialStorageKey(0)).toBeNull()
  })
  it('permite coordenadas libres, rotación y tamaños diferentes', () => {
    const saved = normalizeVisualCredentialDesign({
      version: 1, theme: 'PURPLE_PULSE',
      stickers: [
        { uid: 'a', stickerId: 'STAR', x: 0.234, y: 0.821, size: 0.13, rotation: 25 },
        { uid: 'b', stickerId: 'STAR', x: 0.735, y: 0.174, size: 0.22, rotation: -15 }
      ]
    })
    expect(saved.stickers).toHaveLength(2)
    expect(saved.stickers[0]).toMatchObject({ x: 0.234, y: 0.821, rotation: 25 })
    expect(saved.stickers[1]).toMatchObject({ x: 0.735, y: 0.174 })
  })
  it('recorta datos inválidos y limita la cantidad para evitar almacenamiento excesivo', () => {
    const stickers = Array.from({ length: 25 }, (_, index) => ({
      uid: `s${index}`, stickerId: 'TECH', x: 4, y: -2, size: 9, rotation: 999
    }))
    const saved = normalizeVisualCredentialDesign({ version: 1, theme: 'INVALID', stickers })
    expect(saved.theme).toBe('BLUE_NEON')
    expect(saved.stickers).toHaveLength(VISUAL_CREDENTIAL_MAX_STICKERS)
    expect(saved.stickers[0]).toMatchObject({ x: 1, y: 0, size: 0.36, rotation: 180 })
  })
  it('rechaza versiones incompatibles, identificadores duplicados y elementos arbitrarios', () => {
    expect(normalizeVisualCredentialDesign({ version: 2, stickers: [] })).toEqual(defaultVisualCredentialDesign())
    expect(normalizeVisualCredentialDesign({ version: 1, stickers: [
      { uid: 'a', stickerId: 'STAR', x: 0.5, y: 0.5, size: 0.18, rotation: 0 },
      { uid: 'a', stickerId: 'CODE', x: 0.2, y: 0.2, size: 0.18, rotation: 0 },
      { uid: 'bad!', stickerId: 'TECH', x: 0.1, y: 0.2, size: 0.2, rotation: 0 }
    ] }).stickers).toHaveLength(1)
  })
})
