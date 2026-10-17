import { describe, expect, it } from 'vitest'
import { allowedCredentialSlots, moveCredentialSticker, placeCredentialSticker, serializeCredentialStickers } from '../../utils/credentialStickerSlots'

const slots = ['TOP_LEFT', 'TOP_RIGHT', 'BOTTOM_LEFT', 'BOTTOM_RIGHT']
const ids = ['TECH', 'GAMER', 'CODE', 'STAR']

describe('Editor visual compatible con el contrato V4', () => {
  it('acepta únicamente las 4 zonas del catálogo del backend', () => {
    expect(allowedCredentialSlots([...slots, 'CENTER', 'FREE_XY'])).toEqual(slots)
  })
  it('coloca un sticker autorizado al tocar una zona', () => {
    expect(placeCredentialSticker({}, 'STAR', 'TOP_LEFT', slots, ids)).toEqual({ TOP_LEFT: 'STAR' })
  })
  it('rechaza las posiciones libres y stickers no permitidos', () => {
    const previous = { TOP_LEFT: 'STAR' }
    expect(placeCredentialSticker(previous, 'STAR', 'CENTER', slots, ids)).toBe(previous)
    expect(placeCredentialSticker(previous, 'UNKNOWN', 'TOP_RIGHT', slots, ids)).toBe(previous)
  })
  it('mueve y, al haber otro sticker, intercambia sin perder ninguno', () => {
    const previous = { TOP_LEFT: 'STAR', BOTTOM_RIGHT: 'TECH' }
    expect(moveCredentialSticker(previous, 'TOP_LEFT', 'BOTTOM_RIGHT', slots)).toEqual({ TOP_LEFT: 'TECH', BOTTOM_RIGHT: 'STAR' })
  })
  it('produce exactamente el JSON que recibe el backend y elimina entradas ajenas', () => {
    const placed = { TOP_LEFT: 'STAR', TOP_RIGHT: '', BOTTOM_LEFT: 'CODE', FREE_XY: 'TECH', BOTTOM_RIGHT: 'UNKNOWN' }
    expect(serializeCredentialStickers(placed, slots, ids)).toEqual([
      { stickerId: 'STAR', slot: 'TOP_LEFT' },
      { stickerId: 'CODE', slot: 'BOTTOM_LEFT' }
    ])
  })
})
