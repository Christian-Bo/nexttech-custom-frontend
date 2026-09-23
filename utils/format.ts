/** Formatos de presentación (es-GT). */

const currency = new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' })
const compact = new Intl.NumberFormat('es-GT', { notation: 'compact', maximumFractionDigits: 1 })

export function formatQ(amount: number): string {
  return currency.format(amount)
}

/** Q12.9K para cifras grandes en KPIs. */
export function formatQCompact(amount: number): string {
  return amount >= 10_000 ? `Q${compact.format(amount)}` : currency.format(amount)
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-GT', { dateStyle: 'medium', timeStyle: 'short' })
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })
}

export function formatDayShort(iso: string): string {
  return new Date(iso).toLocaleDateString('es-GT', { weekday: 'short', day: 'numeric' })
}

/** "hace 5 min", "hace 2 h" */
export function timeAgo(iso: string): string {
  const diff = Math.round((Date.now() - Date.parse(iso)) / 60_000)
  if (diff < 1) return 'ahora'
  if (diff < 60) return `hace ${diff} min`
  const h = Math.round(diff / 60)
  if (h < 24) return `hace ${h} h`
  return `hace ${Math.round(h / 24)} d`
}
