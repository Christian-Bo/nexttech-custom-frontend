import { describe, expect, it } from 'vitest'
import { MAX_ZOOM, computeSourceRect, panFromDrag } from '~/features/photo-studio/utils/portrait'

/**
 * Caja blanca: se recorren las ramas internas de computeSourceRect / panFromDrag
 * (imagen horizontal vs vertical, límites de zoom y desplazamiento, tamaño inválido).
 */
describe('computeSourceRect (caja blanca)', () => {
  it('rama 1: imagen horizontal -> se recorta el ancho (alto completo)', () => {
    const r = computeSourceRect(1600, 900, 1, 0, 0)
    expect(r.height).toBe(900)
    expect(r.width).toBeCloseTo(675)
    expect(r.x).toBeCloseTo((1600 - 675) / 2)
    expect(r.y).toBe(0)
  })

  it('rama 2: imagen vertical alta -> se recorta el alto (ancho completo)', () => {
    const r = computeSourceRect(600, 1200, 1, 0, 0)
    expect(r.width).toBe(600)
    expect(r.height).toBeCloseTo(800)
    expect(r.y).toBeCloseTo(200)
  })

  it('rama 3: tamaño inválido -> rectángulo vacío', () => {
    expect(computeSourceRect(0, 500, 1, 0, 0)).toEqual({ x: 0, y: 0, width: 0, height: 0 })
  })

  it('zoom fuera de rango se limita a [1, MAX_ZOOM]', () => {
    const min = computeSourceRect(1200, 1600, 0.2, 0, 0)
    const max = computeSourceRect(1200, 1600, 99, 0, 0)
    expect(min.width).toBe(1200)
    expect(max.width).toBeCloseTo(1200 / MAX_ZOOM)
  })

  it('pan en los extremos pega el recorte al borde sin salirse', () => {
    const left = computeSourceRect(1600, 900, 2, -1, -1)
    const right = computeSourceRect(1600, 900, 2, 5, 5)
    expect(left.x).toBe(0)
    expect(left.y).toBe(0)
    expect(right.x + right.width).toBeCloseTo(1600)
    expect(right.y + right.height).toBeCloseTo(900)
  })
})

describe('panFromDrag (caja blanca)', () => {
  it('sin espacio libre (zoom 1 en imagen 3:4) el pan queda en 0', () => {
    const src = computeSourceRect(600, 800, 1, 0, 0)
    expect(panFromDrag({ panX: 0, panY: 0 }, 50, 50, 300, 400, src, 600, 800)).toEqual({ panX: 0, panY: 0 })
  })

  it('arrastrar a la derecha disminuye panX; el resultado se limita a [-1, 1]', () => {
    const src = computeSourceRect(1600, 900, 2, 0, 0)
    const small = panFromDrag({ panX: 0, panY: 0 }, 20, 0, 300, 400, src, 1600, 900)
    expect(small.panX).toBeLessThan(0)
    const huge = panFromDrag({ panX: 0, panY: 0 }, 10_000, -10_000, 300, 400, src, 1600, 900)
    expect(huge).toEqual({ panX: -1, panY: 1 })
  })
})
