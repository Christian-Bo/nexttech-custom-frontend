/** Dashboard de operaciones. PROVISIONAL hasta el endpoint real (Integrante 3). */
import type { OrderStatus } from '~/types/domain'

export type DashboardRange = 'today' | '7d' | '14d'

export interface DashboardKpisDto {
  ventas: number
  pedidos: number
  ticketPromedio: number
  enProduccion: number
  entregados: number
  /** % de cambio de ventas vs el período anterior de igual duración. */
  deltaVentasPct: number | null
}

export interface SalesPointDto {
  /** ISO del inicio del día (o de la hora cuando range = today). */
  fecha: string
  total: number
  pedidos: number
}

export interface StatusCountDto {
  estado: OrderStatus
  cantidad: number
}

export interface RecentOrderDto {
  idOrden: number
  codigoOrden: string
  nickname: string
  producto: string
  total: number
  estado: OrderStatus
  fechaCreacion: string
}

export interface DashboardSummaryDto {
  kpis: DashboardKpisDto
  ventas: SalesPointDto[]
  estados: StatusCountDto[]
  ultimos: RecentOrderDto[]
}

export interface DashboardService {
  getSummary: (range: DashboardRange) => Promise<DashboardSummaryDto>
}
