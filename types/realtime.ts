/**
 * Contrato de tiempo real (SignalR). PROVISIONAL: nombres de eventos y payloads
 * a confirmar con Integrante 3 cuando publique el hub.
 */
import type { OrderStatus } from './domain'

export type RealtimeStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected'

export interface OrderStatusChangedEvent {
  idOrden: number
  codigoOrden: string
  estado: OrderStatus
  fechaHora: string
  observacion?: string | null
}

export interface OrderCreatedEvent {
  idOrden: number
  codigoOrden: string
  nickname: string
  producto: string
  total: number
  estado: OrderStatus
  fechaCreacion: string
}

/** Mapa evento -> payload. Agregar aquí los eventos nuevos del hub. */
export interface RealtimeEvents {
  OrderStatusChanged: OrderStatusChangedEvent
  OrderCreated: OrderCreatedEvent
}

export type RealtimeEventName = keyof RealtimeEvents
