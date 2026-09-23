import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Caja negra del seguimiento (enunciado 3.j): con la respuesta REAL del backend
 * (GET /api/orders/{codigo}/tracking) el comprador debe ver el estado y su historial.
 */
const apiMock = vi.fn()
vi.mock('~/services/api', () => ({ useApi: () => apiMock }))

const respuestaBackend = {
  codigoOrden: 'ORD-9F3A21BC',
  fechaCreacion: '2026-09-20T15:00:00Z',
  total: 85,
  estado: 'Listo para entrega',
  nicknameComprador: 'sergio',
  areaEntrega: 'Biblioteca',
  referenciaEntrega: 'Mesa 4',
  metodoPago: 'Efectivo',
  estadoPago: 'Pendiente',
  items: [
    { nombreProducto: 'Llavero acrílico', nombreVariante: 'Circular', cantidad: 2, subtotal: 70 },
    { nombreProducto: 'Sticker', nombreVariante: 'Holográfico', cantidad: 1, subtotal: 15 }
  ],
  tracking: [
    { estado: 'Orden generada', fechaHora: '2026-09-20T15:00:00Z' },
    { estado: 'En elaboracion', fechaHora: '2026-09-20T15:01:00Z', observacion: null },
    { estado: 'Listo para entrega', fechaHora: '2026-09-20T15:02:00Z', observacion: 'OK' },
    { estado: 'Estado raro', fechaHora: '2026-09-20T15:03:00Z' }
  ]
}

describe('Seguimiento del pedido con el backend real (caja negra)', () => {
  beforeEach(() => {
    vi.stubGlobal('useRuntimeConfig', () => ({ public: { useMocks: false } }))
    apiMock.mockResolvedValue(respuestaBackend)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    apiMock.mockReset()
  })

  async function consultar(codigo: string) {
    const { useTrackingService } = await import('~/features/tracking/services/trackingService')
    return useTrackingService().getByCode(codigo)
  }

  it('consulta el endpoint con el código limpio y codificado', async () => {
    await consultar('  ORD-9F3A21BC ')
    expect(apiMock).toHaveBeenCalledWith('/api/orders/ORD-9F3A21BC/tracking')
  })

  it('muestra el estado actual, productos, cantidad y pago', async () => {
    const r = await consultar('ORD-9F3A21BC')
    expect(r.estado).toBe('LISTO_PARA_ENTREGA')
    expect(r.producto).toBe('Llavero acrílico (Circular), Sticker (Holográfico)')
    expect(r.cantidad).toBe(3)
    expect(r.metodoPago).toBe('EFECTIVO')
  })

  it('el historial ignora estados desconocidos y conserva el orden', async () => {
    const r = await consultar('ORD-9F3A21BC')
    expect(r.historial.map(h => h.estado)).toEqual(['ORDEN_GENERADA', 'EN_ELABORACION', 'LISTO_PARA_ENTREGA'])
    expect(r.historial[2]!.observacion).toBe('OK')
  })

  it('con "Listo para entrega" se habilita el QR de entrega', async () => {
    expect((await consultar('ORD-9F3A21BC')).qrEntrega).toBe('ORD-9F3A21BC')
  })

  it('en elaboración todavía no hay QR de entrega', async () => {
    apiMock.mockResolvedValue({ ...respuestaBackend, estado: 'En elaboracion' })
    expect((await consultar('ORD-9F3A21BC')).qrEntrega).toBeNull()
  })

  it('un 404 del backend llega como error para mostrar "no encontrado"', async () => {
    apiMock.mockRejectedValue({ status: 404, code: 'NOT_FOUND', message: 'No existe.' })
    await expect(consultar('ORD-000')).rejects.toMatchObject({ status: 404 })
  })
})
