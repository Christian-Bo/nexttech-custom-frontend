import type { OrderTrackingDto, TrackingService } from '../types/tracking'
import { useMockOrders } from '~/services/mock/mockOrders'
import type { ApiError } from '~/types/api'
import { useApi } from '~/services/api'

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

/** Real (provisional): GET /api/orders/{codigo}/tracking — confirmar con Integrante 3. */
function createHttpTrackingService(): TrackingService {
  const api = useApi()
  return {
    getByCode: codigo => api<OrderTrackingDto>(`/api/orders/${encodeURIComponent(codigo)}/tracking`)
  }
}

export function useTrackingService(): TrackingService {
  return useRuntimeConfig().public.useMocks ? createMockTrackingService() : createHttpTrackingService()
}
