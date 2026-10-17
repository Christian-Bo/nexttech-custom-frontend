import type { RecurrenteCheckoutSession } from '../types/orders'

const STORAGE_KEY = 'nt-recurrente-pending-checkout'

interface PendingCheckout {
  buyerId: number
  session: RecurrenteCheckoutSession
}

/** Resguarda la sesión de pago para volver del proveedor sin crear un checkout nuevo. */
export function savePendingCheckout(buyerId: number, session: RecurrenteCheckoutSession): void {
  if (!import.meta.client) return
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ buyerId, session } satisfies PendingCheckout))
}

export function readPendingCheckout(buyerId: number | null): RecurrenteCheckoutSession | null {
  if (!import.meta.client || buyerId === null) return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as PendingCheckout
    if (data.buyerId !== buyerId || !data.session?.checkoutId || !data.session?.checkoutUrl) return null
    return data.session
  }
  catch {
    return null
  }
}

export function clearPendingCheckout(checkoutId: string): void {
  if (!import.meta.client) return
  const raw = sessionStorage.getItem(STORAGE_KEY)
  if (!raw) return
  try {
    const data = JSON.parse(raw) as PendingCheckout
    if (data.session.checkoutId === checkoutId) sessionStorage.removeItem(STORAGE_KEY)
  }
  catch {
    sessionStorage.removeItem(STORAGE_KEY)
  }
}
