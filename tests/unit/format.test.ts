import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatQ, formatQCompact, timeAgo } from '~/utils/format'

describe('formatQ (unitaria)', () => {
  it('formatea montos en quetzales con 2 decimales', () => {
    expect(formatQ(1250.5)).toMatch(/Q\s?1,250\.50/)
  })

  it('formatea cero', () => {
    expect(formatQ(0)).toMatch(/Q\s?0\.00/)
  })
})

describe('formatQCompact (unitaria)', () => {
  it('usa formato normal por debajo de 10 000', () => {
    expect(formatQCompact(9999)).toMatch(/Q\s?9,999\.00/)
  })

  it('usa formato compacto desde 10 000', () => {
    expect(formatQCompact(12_900)).toMatch(/^Q12[.,]9\s?(K|mil)/i)
  })
})

describe('timeAgo (unitaria)', () => {
  afterEach(() => vi.useRealTimers())

  it.each([
    [0, 'ahora'],
    [5, 'hace 5 min'],
    [120, 'hace 2 h'],
    [60 * 48, 'hace 2 d']
  ])('hace %i minutos -> "%s"', (minutes, expected) => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-23T12:00:00Z'))
    const iso = new Date(Date.now() - minutes * 60_000).toISOString()
    expect(timeAgo(iso)).toBe(expected)
  })
})
