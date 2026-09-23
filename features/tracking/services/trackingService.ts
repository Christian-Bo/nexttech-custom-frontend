import type { OrderTrackingDto, TrackingService } from '../types/tracking'
import { useMockOrders } from '~/services/mock/mockOrders'
import type { ApiError } from '~/types/api'
import { useApi } from '~/services/api'
import { paymentMethodFromName, statusFromName } from '~/utils/orderStatus'

const QR_STATES = ['LISTO_PARA_ENTREGA', 'EN_ENTREGA']

function createMockTrackingService(): TrackingService {
  const { orders } = useMockOrders()
  return {
    async getByCode(codigo) {
      await new Promise(r => setTimeout(r, 400))
      const o = orders.value.find(x => x.codigoOrden.toLowerCase() === codigo.trim().toLowerCase())
      if (!o) throw { status: 404, code: 'NOT_FOUND', message: 'No encontramos un pedido con ese código.' } satisfies ApiError
      return structuredClone(toRaw({
        ...o,
        historial: o.historial.map(h => ({ ...h })),
        qrEntrega: QR_STATES.includes(o.estado) ? `NT-${o.codigoOrden}` : null
      })) as OrderTrackingDto
    }
  }
}

/** Respuesta real de GET /api/orders/{codigo}/tracking (OrdenDetalleDto, Integrante 3). */
interface OrdenDetalleApi {
  codigoOrden: string
  fechaCreacion: string
  total: number
  estado: string
  nicknameComprador: string
  areaEntrega: string
  referenciaEntrega: string
  metodoPago: string
  estadoPago: string
  items: { nombreProducto: string, nombreVariante: string, cantidad: number, subtotal: number }[]
  tracking: { estado: string, fechaHora: string, observacion?: string | null }[]
}

function createHttpTrackingService(): TrackingService {
  const api = useApi()
  return {
    async getByCode(codigo) {
      const dto = await api<OrdenDetalleApi>(`/api/orders/${encodeURIComponent(codigo.trim())}/tracking`)
      const estado = statusFromName(dto.estado) ?? 'ORDEN_GENERADA'
      return {
        idOrden: 0,
        codigoOrden: dto.codigoOrden,
        estado,
        producto: dto.items.map(i => `${i.nombreProducto} (${i.nombreVariante})`).join(', ') || 'Pedido',
        cantidad: dto.items.reduce((n, i) => n + i.cantidad, 0),
        total: dto.total,
        metodoPago: paymentMethodFromName(dto.metodoPago),
        areaEntrega: dto.areaEntrega,
        referenciaEntrega: dto.referenciaEntrega,
        fechaCreacion: dto.fechaCreacion,
        historial: dto.tracking
          .map(t => ({ estado: statusFromName(t.estado), fechaHora: t.fechaHora, observacion: t.observacion ?? null }))
          .filter((t): t is { estado: NonNullable<typeof t.estado>, fechaHora: string, observacion: string | null } => t.estado !== null),
        // El QR de la constancia lleva el código de la orden.
        qrEntrega: QR_STATES.includes(estado) ? dto.codigoOrden : null
      }
    }
  }
}

export function useTrackingService(): TrackingService {
  return useRuntimeConfig().public.useMocks ? createMockTrackingService() : createHttpTrackingService()
}
