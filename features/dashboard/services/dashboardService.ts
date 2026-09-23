import type { DashboardRange, DashboardService, DashboardSummaryDto, ProductSalesDto, SalesPointDto, StatusCountDto } from '../types/dashboard'
import type { OrderStatus } from '~/types/domain'
import { useMockOrders } from '~/services/mock/mockOrders'
import { useApi } from '~/services/api'

const DAY = 86_400_000
const STATUS_ORDER: OrderStatus[] = ['ORDEN_GENERADA', 'EN_ELABORACION', 'LISTO_PARA_ENTREGA', 'EN_ENTREGA', 'ENTREGADO', 'COMPRADOR_NO_ENCONTRADO']

function startOfDay(t: number): number {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function createMockDashboardService(): DashboardService {
  const { orders } = useMockOrders()
  return {
    async getSummary(range: DashboardRange) {
      await new Promise(r => setTimeout(r, 350))
      const now = Date.now()
      const all = orders.value
      const firstDay = startOfDay(Math.min(...all.map(o => Date.parse(o.fechaCreacion))))
      // Día = hoy; Semana = últimos 7 días; Total = todo el histórico.
      const days = range === 'day' ? 1 : range === 'week' ? 7 : Math.round((startOfDay(now) - firstDay) / DAY) + 1
      const from = startOfDay(now) - (days - 1) * DAY
      const prevFrom = from - days * DAY
      const inRange = all.filter(o => Date.parse(o.fechaCreacion) >= from)
      const prev = range === 'total' ? [] : all.filter(o => { const t = Date.parse(o.fechaCreacion); return t >= prevFrom && t < from })

      const ventas = inRange.reduce((s, o) => s + o.total, 0)
      const ventasPrev = prev.reduce((s, o) => s + o.total, 0)

      // Serie: por hora si es hoy, por día si es rango.
      const buckets: SalesPointDto[] = []
      if (range === 'day') {
        for (let h = 7; h <= 20; h++) {
          const start = from + h * 3_600_000
          const items = inRange.filter(o => { const t = Date.parse(o.fechaCreacion); return t >= start && t < start + 3_600_000 })
          buckets.push({ fecha: new Date(start).toISOString(), total: items.reduce((s, o) => s + o.total, 0), pedidos: items.length })
        }
      }
      else {
        for (let i = 0; i < days; i++) {
          const start = from + i * DAY
          const items = inRange.filter(o => { const t = Date.parse(o.fechaCreacion); return t >= start && t < start + DAY })
          buckets.push({ fecha: new Date(start).toISOString(), total: items.reduce((s, o) => s + o.total, 0), pedidos: items.length })
        }
      }

      const estados: StatusCountDto[] = STATUS_ORDER.map(estado => ({ estado, cantidad: inRange.filter(o => o.estado === estado).length }))

      const byProduct = new Map<string, ProductSalesDto>()
      for (const o of inRange) {
        const row = byProduct.get(o.producto) ?? { producto: o.producto, unidades: 0, total: 0 }
        row.unidades += o.cantidad
        row.total += o.total
        byProduct.set(o.producto, row)
      }
      const productos = [...byProduct.values()].sort((a, b) => b.total - a.total)

      const summary: DashboardSummaryDto = {
        kpis: {
          ventas,
          pedidos: inRange.length,
          ticketPromedio: inRange.length ? ventas / inRange.length : 0,
          enProduccion: all.filter(o => o.estado === 'EN_ELABORACION').length,
          entregados: inRange.filter(o => o.estado === 'ENTREGADO').length,
          deltaVentasPct: ventasPrev > 0 ? ((ventas - ventasPrev) / ventasPrev) * 100 : null
        },
        ventas: buckets,
        estados,
        productos,
        ultimos: [...inRange]
          .sort((a, b) => b.fechaCreacion.localeCompare(a.fechaCreacion))
          .slice(0, 8)
          .map(({ idOrden, codigoOrden, nickname, producto, total, estado, fechaCreacion }) => ({ idOrden, codigoOrden, nickname, producto, total, estado, fechaCreacion }))
      }
      return structuredClone(summary)
    }
  }
}

/** Real (provisional): GET /api/dashboard/summary?range= — confirmar con Integrante 3. */
function createHttpDashboardService(): DashboardService {
  const api = useApi()
  return {
    getSummary: range => api<DashboardSummaryDto>('/api/dashboard/summary', { query: { range } })
  }
}

export function useDashboardService(): DashboardService {
  return useRuntimeConfig().public.useMocks ? createMockDashboardService() : createHttpDashboardService()
}
