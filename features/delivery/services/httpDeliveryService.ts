import type { DeliveryOrderDto, DeliveryService } from '../types/delivery'
import type { HttpClient } from '~/types/api'
import { isApiError } from '~/services/api'
import { extractOrderCode, paymentStatusFromName, statusFromName } from '~/utils/orderStatus'

/**
 * Servicio real de entregas (Integrante 3, /api/delivery, rol REPARTIDOR).
 * La API no lista "mis entregas en curso": se recuerdan en este dispositivo.
 * La API no valida el QR: se compara en el cliente contra el código de la orden
 * (el QR de la constancia contiene el código).
 */

interface OrdenColaApi { codigoOrden: string, fechaCreacion: string, total: number, estado: string, areaEntrega: string }
interface OrdenEntregaApi {
  codigoOrden: string
  fechaCreacion: string
  total: number
  estado: string
  areaEntrega: string
  referenciaEntrega: string
  nicknameComprador: string
  estadoPago: string
}

const MINE_KEY = 'nt-delivery-mine'
const MAX_PHOTO_BYTES = 2 * 1024 * 1024

function readMine(): string[] {
  try {
    return JSON.parse(localStorage.getItem(MINE_KEY) ?? '[]') as string[]
  }
  catch {
    return []
  }
}

function writeMine(codes: string[]): void {
  try {
    localStorage.setItem(MINE_KEY, JSON.stringify([...new Set(codes)].slice(-50)))
  }
  catch {
    // sin almacenamiento: solo se pierde la lista local de "mis entregas"
  }
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

async function photoPayload(foto: Blob, codigo: string) {
  if (foto.size > MAX_PHOTO_BYTES) {
    throw { status: 400, code: 'PHOTO_TOO_LARGE', message: 'La foto supera los 2 MB. Tómala de nuevo.' }
  }
  const ext = foto.type === 'image/png' ? 'png' : foto.type === 'image/webp' ? 'webp' : 'jpg'
  return { fotoBase64: await toBase64(foto), nombreArchivo: `entrega-${codigo}.${ext}`, tipoMime: foto.type || 'image/jpeg' }
}

export function createHttpDeliveryService(api: HttpClient): DeliveryService {
  const verified = new Set<string>()
  const enc = encodeURIComponent

  function map(dto: OrdenEntregaApi): DeliveryOrderDto {
    const estadoPago = paymentStatusFromName(dto.estadoPago)
    return {
      idOrden: 0,
      codigoOrden: dto.codigoOrden,
      nicknameComprador: dto.nicknameComprador,
      telefonoComprador: null,
      areaEntrega: dto.areaEntrega,
      referenciaEntrega: dto.referenciaEntrega,
      estado: statusFromName(dto.estado) ?? 'LISTO_PARA_ENTREGA',
      total: dto.total,
      // Hoy el checkout solo acepta efectivo; con tarjeta el pago ya llega "Pagado".
      pago: { metodo: estadoPago === 'PENDIENTE' ? 'EFECTIVO' : 'TARJETA', estado: estadoPago, monto: dto.total },
      items: [],
      fechaCreacion: dto.fechaCreacion,
      qrUtilizado: verified.has(dto.codigoOrden),
      ultimoIntento: null
    }
  }

  async function getOrder(codigo: string): Promise<DeliveryOrderDto> {
    return map(await api<OrdenEntregaApi>(`/api/delivery/orders/${enc(codigo)}`))
  }

  return {
    capabilities: { paymentFailure: true },

    async listAssigned() {
      const available = await api<OrdenColaApi[]>('/api/delivery/available')
      const codes = [...new Set([...available.map(o => o.codigoOrden), ...readMine()])]
      const results = await Promise.allSettled(codes.map(getOrder))
      return results
        .filter((r): r is PromiseFulfilledResult<DeliveryOrderDto> => r.status === 'fulfilled')
        .map(r => r.value)
    },

    getOrder,

    async startDelivery(codigo) {
      await api(`/api/delivery/${enc(codigo)}/take`, { method: 'POST' })
      writeMine([...readMine(), codigo])
      return getOrder(codigo)
    },

    async validateOrderQr(codigo, qr) {
      const scanned = extractOrderCode(qr)
      if (scanned !== codigo.toUpperCase()) return { ok: false, message: 'El QR no corresponde a esta orden.' }
      verified.add(codigo)
      return { ok: true, message: 'QR verificado: es el comprador correcto.' }
    },

    async findByQr(input) {
      try {
        return await getOrder(extractOrderCode(input))
      }
      catch (e) {
        if (isApiError(e) && e.status === 404) return null
        throw e
      }
    },

    async complete(codigo, body) {
      await api(`/api/delivery/${enc(codigo)}/complete`, { method: 'POST', body: await photoPayload(body.foto, codigo), timeout: 45_000 })
      const order = await getOrder(codigo)
      return { ...order, ultimoIntento: { resultado: 'ENTREGADO', fechaHoraFin: new Date().toISOString(), observacion: body.observacion ?? null } }
    },

    async reportFailed(codigo, body) {
      // Comprador no encontrado y pago no realizado son dos resultados distintos en el backend.
      const action = body.resultado === 'PAGO_NO_REALIZADO' ? 'payment-failed' : 'not-found'
      await api(`/api/delivery/${enc(codigo)}/${action}`, { method: 'POST', body: { observacion: body.observacion } })
      writeMine(readMine().filter(c => c !== codigo))
      const order = await getOrder(codigo)
      return { ...order, ultimoIntento: { resultado: body.resultado, fechaHoraFin: new Date().toISOString(), observacion: body.observacion } }
    }
  }
}
