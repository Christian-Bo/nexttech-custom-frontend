/**
 * MOCK compartido de órdenes para tracking y dashboard (mientras Integrante 3
 * publica los endpoints). Datos deterministas + simulador de eventos en vivo.
 * Códigos NTC-1042..1045 coinciden con la app del repartidor.
 */
import type { OrderStatus } from '~/types/domain'
import type { RealtimeEventName, RealtimeEvents } from '~/types/realtime'

export interface MockOrderHistory {
  estado: OrderStatus
  fechaHora: string
  observacion?: string | null
}

export interface MockOrder {
  idOrden: number
  codigoOrden: string
  nickname: string
  producto: string
  cantidad: number
  total: number
  metodoPago: 'EFECTIVO' | 'TARJETA'
  estado: OrderStatus
  areaEntrega: string
  referenciaEntrega: string
  fechaCreacion: string
  historial: MockOrderHistory[]
}

const FLOW: OrderStatus[] = ['ORDEN_GENERADA', 'EN_ELABORACION', 'LISTO_PARA_ENTREGA', 'EN_ENTREGA', 'ENTREGADO']
const AREAS: [string, string][] = [
  ['Biblioteca', 'Segundo nivel, mesas junto a la ventana'],
  ['Cafeteria', 'Frente a la caja'],
  ['Entrada principal', 'Garita de seguridad'],
  ['Edificio principal', 'Salón 305, tercer nivel']
]
const PRODUCTS: [string, number][] = [
  ['Llavero acrílico circular', 35], ['Llavero acrílico cuadrado', 35],
  ['Llavero metálico circular', 45], ['Photocard', 10], ['Imán rectangular', 15]
]
const NICKS = ['maria_fer', 'luisg', 'camila.r', 'diego_dev', 'ana_t', 'jose.m', 'sofi22', 'kevin_gt', 'andrea.l', 'pablo_x', 'vale.c', 'rodri']

// PRNG determinista para que el mock sea estable entre recargas.
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function buildHistory(created: number, finalState: OrderStatus, rnd: () => number): MockOrderHistory[] {
  const history: MockOrderHistory[] = []
  let t = created
  for (const s of FLOW) {
    history.push({ estado: s, fechaHora: new Date(t).toISOString() })
    if (s === finalState) break
    t += (20 + rnd() * 160) * 60_000
    if (t > Date.now()) break
  }
  if (finalState === 'COMPRADOR_NO_ENCONTRADO') {
    history.push({ estado: 'COMPRADOR_NO_ENCONTRADO', fechaHora: new Date(Math.min(t + 30 * 60_000, Date.now())).toISOString(), observacion: 'No se encontró al comprador en el punto de entrega.' })
  }
  return history
}

function seed(): MockOrder[] {
  const rnd = mulberry32(2027)
  const orders: MockOrder[] = []
  const now = Date.now()
  let id = 500
  for (let day = 13; day >= 0; day--) {
    const perDay = 4 + Math.floor(rnd() * 7) + (day % 7 === 2 ? 4 : 0)
    for (let i = 0; i < perDay; i++) {
      id++
      const created = now - day * 86_400_000 - Math.floor(rnd() * 10) * 3_600_000 - 3_600_000
      const [producto, precio] = PRODUCTS[Math.floor(rnd() * PRODUCTS.length)]!
      const cantidad = 1 + Math.floor(rnd() * 3)
      const [area, ref] = AREAS[Math.floor(rnd() * AREAS.length)]!
      const age = (now - created) / 3_600_000
      const finalState: OrderStatus = age > 30
        ? (rnd() < 0.06 ? 'COMPRADOR_NO_ENCONTRADO' : 'ENTREGADO')
        : FLOW[Math.min(4, Math.floor(rnd() * 5))]!
      const historial = buildHistory(created, finalState, rnd)
      orders.push({
        idOrden: id,
        codigoOrden: `NTC-${id}`,
        nickname: NICKS[Math.floor(rnd() * NICKS.length)]!,
        producto,
        cantidad,
        total: precio * cantidad,
        metodoPago: rnd() < 0.5 ? 'EFECTIVO' : 'TARJETA',
        estado: historial[historial.length - 1]!.estado,
        areaEntrega: area,
        referenciaEntrega: ref,
        fechaCreacion: new Date(created).toISOString(),
        historial
      })
    }
  }
  // Órdenes "de hoy" que coinciden con la app del repartidor.
  const fixed: [number, string, string, number, OrderStatus, 'EFECTIVO' | 'TARJETA', number][] = [
    [1042, 'maria_fer', 'Llavero acrílico circular', 85, 'LISTO_PARA_ENTREGA', 'EFECTIVO', 180],
    [1043, 'luisg', 'Llavero metálico cuadrado', 35, 'LISTO_PARA_ENTREGA', 'TARJETA', 140],
    [1044, 'camila.r', 'Photocard', 120, 'EN_ENTREGA', 'EFECTIVO', 95],
    [1045, 'diego_dev', 'Llavero acrílico circular', 45, 'EN_ELABORACION', 'TARJETA', 60],
    [1046, 'sofi22', 'Photocard', 30, 'ORDEN_GENERADA', 'TARJETA', 5]
  ]
  for (const [idOrden, nick, producto, total, estado, metodo, minsAgo] of fixed) {
    const created = now - minsAgo * 60_000
    const steps = FLOW.slice(0, FLOW.indexOf(estado) + 1)
    orders.push({
      idOrden, codigoOrden: `NTC-${idOrden}`, nickname: nick, producto, cantidad: 1, total, metodoPago: metodo, estado,
      areaEntrega: 'Biblioteca', referenciaEntrega: 'Segundo nivel, mesas junto a la ventana',
      fechaCreacion: new Date(created).toISOString(),
      historial: steps.map((s, i) => ({ estado: s, fechaHora: new Date(created + i * (minsAgo / steps.length) * 60_000).toISOString() }))
    })
  }
  return orders
}

// ---------------------------------------------------------------------------
// Bus de eventos simulado (lo consume el transporte mock de useRealtime)
// ---------------------------------------------------------------------------

type Listener = (event: RealtimeEventName, payload: unknown) => void
const listeners = new Set<Listener>()

export function onMockEvent(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function emit<K extends RealtimeEventName>(event: K, payload: RealtimeEvents[K]): void {
  listeners.forEach(l => l(event, payload))
}

// ---------------------------------------------------------------------------
// Acceso a los datos
// ---------------------------------------------------------------------------

export function useMockOrders() {
  const orders = useState<MockOrder[]>('nt-mock-orders', seed)

  function advance(order: MockOrder, observacion?: string): boolean {
    const idx = FLOW.indexOf(order.estado)
    if (idx < 0 || idx >= FLOW.length - 1) return false
    const next = FLOW[idx + 1]!
    const fechaHora = new Date().toISOString()
    order.estado = next
    order.historial.push({ estado: next, fechaHora, observacion: observacion ?? null })
    emit('OrderStatusChanged', { idOrden: order.idOrden, codigoOrden: order.codigoOrden, estado: next, fechaHora, observacion })
    return true
  }

  /** Avanza una orden específica (botón "Simular avance" del tracking). */
  function advanceByCode(codigo: string): boolean {
    const o = orders.value.find(x => x.codigoOrden === codigo)
    return o ? advance(o) : false
  }

  function createRandomOrder(): void {
    const rnd = Math.random
    const [producto, precio] = PRODUCTS[Math.floor(rnd() * PRODUCTS.length)]!
    const [area, ref] = AREAS[Math.floor(rnd() * AREAS.length)]!
    const idOrden = Math.max(...orders.value.map(o => o.idOrden)) + 1
    const fechaCreacion = new Date().toISOString()
    const cantidad = 1 + Math.floor(rnd() * 3)
    const order: MockOrder = {
      idOrden, codigoOrden: `NTC-${idOrden}`, nickname: NICKS[Math.floor(rnd() * NICKS.length)]!, producto, cantidad,
      total: precio * cantidad, metodoPago: rnd() < 0.5 ? 'EFECTIVO' : 'TARJETA', estado: 'ORDEN_GENERADA',
      areaEntrega: area, referenciaEntrega: ref, fechaCreacion,
      historial: [{ estado: 'ORDEN_GENERADA', fechaHora: fechaCreacion }]
    }
    orders.value.push(order)
    emit('OrderCreated', { idOrden, codigoOrden: order.codigoOrden, nickname: order.nickname, producto, total: order.total, estado: order.estado, fechaCreacion })
  }

  /** Orden creada desde el checkout de demostración. Devuelve el código. */
  function createOrder(data: Pick<MockOrder, 'nickname' | 'producto' | 'cantidad' | 'total' | 'metodoPago' | 'areaEntrega' | 'referenciaEntrega'>): string {
    const idOrden = Math.max(...orders.value.map(o => o.idOrden)) + 1
    const fechaCreacion = new Date().toISOString()
    const order: MockOrder = {
      ...data,
      idOrden,
      codigoOrden: `NTC-${idOrden}`,
      estado: 'ORDEN_GENERADA',
      fechaCreacion,
      historial: [{ estado: 'ORDEN_GENERADA', fechaHora: fechaCreacion }]
    }
    orders.value.push(order)
    emit('OrderCreated', { idOrden, codigoOrden: order.codigoOrden, nickname: order.nickname, producto: order.producto, total: order.total, estado: order.estado, fechaCreacion })
    return order.codigoOrden
  }

  /** Un "latido" del simulador: crea o avanza órdenes al azar. */
  function tick(): void {
    if (Math.random() < 0.35) {
      createRandomOrder()
      return
    }
    const active = orders.value.filter(o => FLOW.indexOf(o.estado) >= 0 && o.estado !== 'ENTREGADO' && !['NTC-1042', 'NTC-1043', 'NTC-1044', 'NTC-1045', 'NTC-1046'].includes(o.codigoOrden))
    const pick = active[Math.floor(Math.random() * active.length)]
    if (pick) advance(pick)
  }

  return { orders, advanceByCode, createOrder, tick }
}
