import type { OrderStatus } from '~/types/domain'
import { ORDER_STATUS } from '~/types/domain'

/**
 * El backend devuelve el NOMBRE del estado ("En elaboracion", "Listo para entrega").
 * Lo convertimos al código estable (EN_ELABORACION, LISTO_PARA_ENTREGA...).
 */
export function statusFromName(value: string | null | undefined): OrderStatus | null {
  if (!value) return null
  const code = value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
  return (Object.values(ORDER_STATUS) as string[]).includes(code) ? code as OrderStatus : null
}

/** "Efectivo" / "EFECTIVO" / "Tarjeta de crédito" -> EFECTIVO | TARJETA */
export function paymentMethodFromName(value: string | null | undefined): 'EFECTIVO' | 'TARJETA' {
  return (value ?? '').toUpperCase().startsWith('EFECT') ? 'EFECTIVO' : 'TARJETA'
}

/** "Pendiente" / "Pagado" / "Rechazado" -> código */
export function paymentStatusFromName(value: string | null | undefined): 'PENDIENTE' | 'PAGADO' | 'RECHAZADO' {
  const v = (value ?? '').toUpperCase()
  if (v.startsWith('PAG')) return 'PAGADO'
  if (v.startsWith('RECH')) return 'RECHAZADO'
  return 'PENDIENTE'
}

/**
 * Extrae el código de orden de lo que se escaneó o tecleó.
 * Acepta "ORD-1A2B3C4D", "ord1a2b3c4d", "NT-ORD-1A2B3C4D" o una URL que lo contenga.
 */
export function extractOrderCode(input: string): string {
  const text = input.trim().toUpperCase()
  const match = text.match(/(ORD|NTC)-?([0-9A-F]{3,})/)
  if (match) return `${match[1]}-${match[2]}`
  return text.replace(/^NT-/, '')
}
