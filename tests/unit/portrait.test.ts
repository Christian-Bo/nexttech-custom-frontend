import { describe, expect, it } from 'vitest'
import {
  MAX_PORTRAIT_STICKERS,
  PORTRAIT_FILTERS,
  addSticker,
  clamp,
  filterCss,
  hitSticker,
  moveSticker,
  removeSticker,
  resizeSticker
} from '~/features/photo-studio/utils/portrait'
import type { PortraitSticker } from '~/features/photo-studio/utils/portrait'

describe('clamp (unitaria)', () => {
  it('limita al rango', () => {
    expect(clamp(5, 0, 1)).toBe(1)
    expect(clamp(-5, 0, 1)).toBe(0)
    expect(clamp(0.5, 0, 1)).toBe(0.5)
  })

  it('NaN se vuelve el mínimo', () => {
    expect(clamp(Number.NaN, 2, 3)).toBe(2)
  })
})

describe('filterCss (unitaria)', () => {
  it('cada filtro tiene un valor CSS', () => {
    for (const f of PORTRAIT_FILTERS) expect(filterCss(f.name)).toBe(f.css)
  })

  it('"none" no altera la imagen', () => {
    expect(filterCss('none')).toBe('none')
  })
})

describe('stickers de la foto (unitaria)', () => {
  it('agrega hasta 3 stickers y luego rechaza el cuarto', () => {
    let list: PortraitSticker[] = []
    for (let i = 0; i < MAX_PORTRAIT_STICKERS; i++) {
      const next = addSticker(list, '⭐')
      expect(next).not.toBeNull()
      list = next!
    }
    expect(list).toHaveLength(3)
    expect(addSticker(list, '🚀')).toBeNull()
  })

  it('no modifica la lista original (inmutable)', () => {
    const list: PortraitSticker[] = []
    addSticker(list, '⭐')
    expect(list).toHaveLength(0)
  })

  it('mueve, cambia de tamaño y quita dentro de los límites', () => {
    const list = addSticker([], '😎')!
    const id = list[0]!.id
    const moved = moveSticker(list, id, 1.5, -0.2)
    expect(moved[0]).toMatchObject({ x: 1, y: 0 })
    expect(resizeSticker(list, id, 5)[0]!.size).toBe(0.4)
    expect(resizeSticker(list, id, 0)[0]!.size).toBe(0.08)
    expect(removeSticker(list, id)).toHaveLength(0)
  })

  it('detecta el sticker bajo el puntero', () => {
    const list = addSticker([], '😎')!
    const s = list[0]!
    expect(hitSticker(list, s.x, s.y)?.id).toBe(s.id)
    expect(hitSticker(list, 0.5, 0.5)).toBeNull()
  })
})
