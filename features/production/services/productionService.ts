import type { ProductionDetail, ProductionOrderDto, ProductionService } from '../types/production'
import { useApi } from '~/services/api'
import type { HttpClient } from '~/types/api'
import { useMockOrders } from '~/services/mock/mockOrders'
import { statusFromName } from '~/utils/orderStatus'

interface OrdenColaApi { codigoOrden: string, fechaCreacion: string, total: number, estado: string, areaEntrega: string, nickname?: string, nicknameComprador?: string }

export function createHttpProductionService(api: HttpClient): ProductionService {
  const map = (o: OrdenColaApi): ProductionOrderDto => ({ ...o, nicknameComprador: o.nicknameComprador ?? o.nickname, estado: statusFromName(o.estado) ?? 'EN_ELABORACION' })
  const nicknameCache = new Map<string, string>()
  async function inProduction(): Promise<ProductionOrderDto[]> {
    const orders = (await api<OrdenColaApi[]>('/api/supervisor/orders/in-production')).map(map)
    // OrdenColaDto NO incluye nickname, pero OrdenProduccionDto sí lo tiene.
    // Consultar cada detalle sólo la primera vez y de 4 en 4 para no saturar la API.
    const missing = orders.filter(o => !o.nicknameComprador && !nicknameCache.has(o.codigoOrden))
    for (let i = 0; i < missing.length; i += 4) {
      await Promise.all(missing.slice(i, i + 4).map(async (order) => {
        try {
          const detail = await api<ProductionDetail>(`/api/supervisor/orders/${encodeURIComponent(order.codigoOrden)}`)
          if (detail.nicknameComprador) nicknameCache.set(order.codigoOrden, detail.nicknameComprador)
        }
        catch { /* La cola sigue disponible aunque falle un detalle individual. */ }
      }))
    }
    return orders.map(o => ({ ...o, nicknameComprador: o.nicknameComprador ?? nicknameCache.get(o.codigoOrden) }))
  }
  return {
    listInProduction: inProduction,
    listReady: async () => (await api<OrdenColaApi[]>('/api/supervisor/orders/ready')).map(map),
    markReady: async (codigo) => {
      await api(`/api/supervisor/orders/${encodeURIComponent(codigo)}/ready`, { method: 'POST' })
    },
    getDetail: async (codigo) => {
      const d = await api<ProductionDetail & { estado: string }>(`/api/supervisor/orders/${encodeURIComponent(codigo)}`)
      return { ...d, estado: statusFromName(d.estado) ?? 'EN_ELABORACION', items: d.items ?? [] }
    },
    downloadFile: (codigo, idArchivo) =>
      api<Blob>(`/api/supervisor/orders/${encodeURIComponent(codigo)}/files/${idArchivo}`, { responseType: 'blob', timeout: 30_000 }),
    printSelected: async (codigos) => {
      if (!codigos.length || codigos.length > 50) throw { status: 400, code: 'PRINT_COUNT', message: 'Selecciona entre 1 y 50 pedidos por lote.' }
      return await api<Blob>('/api/supervisor/orders/print', { method: 'POST', body: { codigos }, responseType: 'blob', timeout: 90_000 })
    },
    printQueue: () => api<Blob>('/api/supervisor/orders/print-queue', { responseType: 'blob', timeout: 90_000 }),
    reprint: (codigo) => api<Blob>(`/api/supervisor/orders/${encodeURIComponent(codigo)}/print`, { responseType: 'blob', timeout: 60_000 })
  }
}

function createMockProductionService(): ProductionService {
  const { orders, advanceByCode } = useMockOrders()
  const pick = (estado: string) => orders.value
    .filter(o => o.estado === estado)
    .sort((a, b) => a.fechaCreacion.localeCompare(b.fechaCreacion))
    .map(o => ({ codigoOrden: o.codigoOrden, fechaCreacion: o.fechaCreacion, total: o.total, estado: o.estado, areaEntrega: o.areaEntrega }))
  return {
    listInProduction: async () => pick('EN_ELABORACION'),
    listReady: async () => pick('LISTO_PARA_ENTREGA'),
    markReady: async (codigo) => {
      await new Promise(r => setTimeout(r, 300))
      advanceByCode(codigo)
    },
    getDetail: async (codigo) => {
      await new Promise(r => setTimeout(r, 250))
      const o = orders.value.find(x => x.codigoOrden === codigo)
      if (!o) throw { status: 404, code: 'NOT_FOUND', message: 'La orden no existe.' }
      return {
        codigoOrden: o.codigoOrden,
        fechaCreacion: o.fechaCreacion,
        total: o.total,
        estado: o.estado,
        areaEntrega: o.areaEntrega,
        referenciaEntrega: o.referenciaEntrega,
        nicknameComprador: o.nickname,
        idArchivoConstancia: null,
        // En modo demo no hay imágenes finales: se muestran los artículos sin archivos.
        items: [{ nombreProducto: o.producto, nombreVariante: '', cantidad: o.cantidad, atributosJson: '{}', idPersonalizacion: null, zonas: [] }]
      }
    },
    downloadFile: async () => {
      throw { status: 404, code: 'NOT_FOUND', message: 'En modo demo no hay archivos de impresión.' }
    },
    printSelected: async () => { throw { status: 404, code: 'MOCK_PRINT', message: 'La impresión PDF requiere el backend real.' } },
    printQueue: async () => { throw { status: 404, code: 'MOCK_PRINT', message: 'La impresión PDF requiere el backend real.' } },
    reprint: async () => { throw { status: 404, code: 'MOCK_PRINT', message: 'La impresión PDF requiere el backend real.' } }
  }
}

export function useProductionService(): ProductionService {
  return useRuntimeConfig().public.useMocks ? createMockProductionService() : createHttpProductionService(useApi())
}
