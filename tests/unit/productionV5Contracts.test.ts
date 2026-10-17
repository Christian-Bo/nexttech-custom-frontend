import { describe, expect, it, vi } from 'vitest'
import { createHttpProductionService } from '~/features/production/services/productionService'
import type { HttpClient } from '~/types/api'

describe('Contrato de impresión en el taller', () => {
  it('imprime un lote de códigos usando un único PDF', async () => {
    const pdf = new Blob(['%PDF-1.7'], { type: 'application/pdf' })
    const api = vi.fn().mockResolvedValue(pdf) as unknown as HttpClient
    const result = await createHttpProductionService(api).printSelected(['ORD-1', 'ORD-2'])
    expect(result).toBe(pdf)
    expect(api).toHaveBeenCalledWith('/api/supervisor/orders/print', {
      method: 'POST', body: { codigos: ['ORD-1', 'ORD-2'] }, responseType: 'blob', timeout: 90_000
    })
  })
  it('no permite más de 50 códigos ni lotes vacíos', async () => {
    const api = vi.fn() as unknown as HttpClient
    const service = createHttpProductionService(api)
    await expect(service.printSelected([])).rejects.toMatchObject({ status: 400 })
    await expect(service.printSelected(Array.from({ length: 51 }, (_, i) => `ORD-${i}`))).rejects.toMatchObject({ status: 400 })
    expect(api).not.toHaveBeenCalled()
  })
  it('cola y reimpresión apuntan a rutas separadas', async () => {
    const api = vi.fn().mockResolvedValue(new Blob()) as unknown as HttpClient
    const service = createHttpProductionService(api)
    await service.printQueue()
    await service.reprint('ORD-8')
    expect(api).toHaveBeenNthCalledWith(1, '/api/supervisor/orders/print-queue', { responseType: 'blob', timeout: 90_000 })
    expect(api).toHaveBeenNthCalledWith(2, '/api/supervisor/orders/ORD-8/print', { responseType: 'blob', timeout: 60_000 })
  })
})
