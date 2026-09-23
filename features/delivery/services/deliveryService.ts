import type { DeliveryService } from '../types/delivery'
import { createMockDeliveryService } from './mockDeliveryService'
import { createHttpDeliveryService } from './httpDeliveryService'
import { useApi } from '~/services/api'

/**
 * Punto único para obtener el servicio de entregas.
 * MOCK o API real (Integrante 3) según `runtimeConfig.public.useMocks`.
 */
export function useDeliveryService(): DeliveryService {
  return useRuntimeConfig().public.useMocks ? createMockDeliveryService() : createHttpDeliveryService(useApi())
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
