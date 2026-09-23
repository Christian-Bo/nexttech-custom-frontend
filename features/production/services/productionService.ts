import type { ProductionOrderDto, ProductionService } from '../types/production'
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
    }
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
    }
  }
}

export function useProductionService(): ProductionService {
  return useRuntimeConfig().public.useMocks ? createMockProductionService() : createHttpProductionService()
}
