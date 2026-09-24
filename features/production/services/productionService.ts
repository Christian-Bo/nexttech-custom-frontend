import type { ProductionDetail, ProductionOrderDto, ProductionService } from '../types/production'
import { useApi } from '~/services/api'
import { useMockOrders } from '~/services/mock/mockOrders'
import { statusFromName } from '~/utils/orderStatus'

interface OrdenColaApi { codigoOrden: string, fechaCreacion: string, total: number, estado: string, areaEntrega: string }

function createHttpProductionService(): ProductionService {
  const api = useApi()
  const map = (o: OrdenColaApi): ProductionOrderDto => ({ ...o, estado: statusFromName(o.estado) ?? 'EN_ELABORACION' })
  return {
    listInProduction: async () => (await api<OrdenColaApi[]>('/api/supervisor/orders/in-production')).map(map),
    listReady: async () => (await api<OrdenColaApi[]>('/api/supervisor/orders/ready')).map(map),
    markReady: async (codigo) => {
      await api(`/api/supervisor/orders/${encodeURIComponent(codigo)}/ready`, { method: 'POST' })
    },
    getDetail: async (codigo) => {
      const d = await api<ProductionDetail & { estado: string }>(`/api/supervisor/orders/${encodeURIComponent(codigo)}`)
      return { ...d, estado: statusFromName(d.estado) ?? 'EN_ELABORACION', items: d.items ?? [] }
    },
    downloadFile: (codigo, idArchivo) =>
      api<Blob>(`/api/supervisor/orders/${encodeURIComponent(codigo)}/files/${idArchivo}`, { responseType: 'blob', timeout: 30_000 })
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
    }
  }
}

export function useProductionService(): ProductionService {
  return useRuntimeConfig().public.useMocks ? createMockProductionService() : createHttpProductionService()
}
