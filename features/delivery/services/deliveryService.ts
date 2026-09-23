import type { DeliveryService } from '../types/delivery'
import { createMockDeliveryService } from './mockDeliveryService'

/**
 * Punto único para obtener el servicio de entregas.
 * Hoy: MOCK. Cuando existan los endpoints (Integrante 3), crear
 * `createHttpDeliveryService(useApi())` con la misma interfaz y elegirlo aquí
 * según `runtimeConfig.public.useMocks`.
 */
export function useDeliveryService(): DeliveryService {
  return createMockDeliveryService()
}

export function formatQ(amount: number): string {
  return new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(amount)
}

export const AREA_ICONS: Record<string, string> = {
  'Entrada principal': 'mdi-gate',
  'Cafeteria': 'mdi-coffee-outline',
  'Biblioteca': 'mdi-bookshelf',
  'Edificio principal': 'mdi-office-building-outline'
}
