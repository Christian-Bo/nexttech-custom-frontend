/**
 * DTOs de dominio conocidos del modelo.
 * PROVISIONAL: a reconciliar con Swagger cuando Integrante 3 publique los endpoints.
 */

/** Identidad central del comprador (Oracle, solo lectura). No trae foto ni password. */
export interface CompradorCentralDto {
  idUsuario: number
  correo: string
  telefono?: string | null
  fechaNacimiento?: string | null
  nickname: string
  notificaEmail: boolean
  notificaWhatsApp: boolean
}

/** Estados de orden sembrados en SQL Server (tabla EstadoOrden). */
export const ORDER_STATUS = {
  ORDEN_GENERADA: 'ORDEN_GENERADA',
  EN_ELABORACION: 'EN_ELABORACION',
  LISTO_PARA_ENTREGA: 'LISTO_PARA_ENTREGA',
  EN_ENTREGA: 'EN_ENTREGA',
  ENTREGADO: 'ENTREGADO',
  COMPRADOR_NO_ENCONTRADO: 'COMPRADOR_NO_ENCONTRADO'
} as const

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS]

/** El comprador solo ve el tracking hasta "Listo para entrega"; el resto es operativo. */
export const BUYER_VISIBLE_ORDER_STATUS: readonly OrderStatus[] = [
  ORDER_STATUS.ORDEN_GENERADA,
  ORDER_STATUS.EN_ELABORACION,
  ORDER_STATUS.LISTO_PARA_ENTREGA
]
