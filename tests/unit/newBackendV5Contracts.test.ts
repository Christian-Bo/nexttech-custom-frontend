import { describe, expect, it, vi } from 'vitest'
import { createCredentialService } from '~/services/credentialService'
import { fromApiTracking } from '~/features/tracking/services/trackingService'
import type { HttpClient } from '~/types/api'

describe('Contratos de backend: credencial V4 + seguimiento V5', () => {
  it('preview genera un PDF sin confirmar o rotar QR', async () => {
    const pdf = new Blob(['%PDF-1.7'], { type: 'application/pdf' })
    const api = vi.fn().mockResolvedValue(pdf) as unknown as HttpClient
    const design = { templateId: 'NEXTTECH_DARK', stickers: [{ stickerId: 'TECH', slot: 'TOP_LEFT' }] }
    await createCredentialService(api).preview(design)
    expect(api).toHaveBeenCalledWith('/api/credential/preview', {
      method: 'POST', body: design, responseType: 'blob', timeout: 45_000
    })
  })
  it('confirm usa el endpoint oficial que emite y envía el PDF', async () => {
    const api = vi.fn().mockResolvedValue(new Blob(['%PDF-1.7'])) as unknown as HttpClient
    const design = { templateId: 'NEXTTECH_BLUE', stickers: [] }
    await createCredentialService(api).confirm(design)
    expect(api).toHaveBeenCalledWith('/api/credential/confirm', {
      method: 'POST', body: design, responseType: 'blob', timeout: 60_000
    })
  })
  it('tracking conserva pasos reales y ordena por orden', () => {
    const original = {
      codigoOrden: 'ORD-TEST', fechaCreacion: '2026-10-16T12:00:00Z', total: 20,
      estado: 'EN_ELABORACION', nicknameComprador: 'buyer', areaEntrega: 'Recepción', referenciaEntrega: 'Entrada',
      metodoPago: 'TARJETA', estadoPago: 'PAGADO',
      items: [{ nombreProducto: 'Llavero', nombreVariante: 'NFC', cantidad: 1, subtotal: 20 }],
      tracking: [{ estado: 'EN_ELABORACION', fechaHora: '2026-10-16T12:05:00Z', observacion: 'Cortando' }],
      pasos: [
        { orden: 2, codigo: 'EN_ELABORACION', nombre: 'En elaboración', actual: true, completado: false },
        { orden: 1, codigo: 'ORDEN_GENERADA', nombre: 'Orden generada', actual: false, completado: true }
      ]
    }
    const result = fromApiTracking(original)
    expect(result.pasos?.map(x => x.orden)).toEqual([1, 2])
    expect(result.pasos?.[1]?.actual).toBe(true)
    expect(result.historial[0]?.observacion).toBe('Cortando')
  })
})
