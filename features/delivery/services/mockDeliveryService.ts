import type { DeliveryOrderDto, DeliveryService } from '../types/delivery'
import type { ApiError } from '~/types/api'

/**
 * MOCK del servicio de entregas (mientras Integrante 3 publica los endpoints).
 * Estado en memoria del navegador; simula latencia y errores de negocio.
 * QR de prueba de cada orden: "NT-<codigoOrden>" (p. ej. NT-NTC-1042).
 */

const delay = (ms = 450) => new Promise(r => setTimeout(r, ms))
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString()

function seed(): DeliveryOrderDto[] {
  return [
    {
      idOrden: 1042, codigoOrden: 'NTC-1042', nicknameComprador: 'maria_fer', telefonoComprador: '+50255512345',
      areaEntrega: 'Biblioteca', referenciaEntrega: 'Segundo nivel, mesas junto a la ventana',
      estado: 'LISTO_PARA_ENTREGA', total: 85, fechaCreacion: minutesAgo(180), qrUtilizado: false,
      pago: { metodo: 'EFECTIVO', estado: 'PENDIENTE', monto: 85 },
      items: [
        { idDetalleOrden: 1, nombreProducto: 'Llavero Personalizado', nombreVariante: 'Acrílico Circular Mediano', cantidad: 2, subtotal: 70, personalizado: true },
        { idDetalleOrden: 2, nombreProducto: 'Imán', nombreVariante: 'Rectangular', cantidad: 1, subtotal: 15, personalizado: true }
      ]
    },
    {
      idOrden: 1043, codigoOrden: 'NTC-1043', nicknameComprador: 'luisg', telefonoComprador: '+50255598765',
      areaEntrega: 'Cafeteria', referenciaEntrega: 'Frente a la caja, playera azul',
      estado: 'LISTO_PARA_ENTREGA', total: 35, fechaCreacion: minutesAgo(140), qrUtilizado: false,
      pago: { metodo: 'TARJETA', estado: 'PAGADO', monto: 35 },
      items: [
        { idDetalleOrden: 3, nombreProducto: 'Llavero Personalizado', nombreVariante: 'Metálico Cuadrado Mediano', cantidad: 1, subtotal: 35, personalizado: true }
      ]
    },
    {
      idOrden: 1044, codigoOrden: 'NTC-1044', nicknameComprador: 'camila.r', telefonoComprador: null,
      areaEntrega: 'Entrada principal', referenciaEntrega: 'Garita de seguridad',
      estado: 'EN_ENTREGA', total: 120, fechaCreacion: minutesAgo(95), qrUtilizado: false,
      pago: { metodo: 'EFECTIVO', estado: 'PENDIENTE', monto: 120 },
      items: [
        { idDetalleOrden: 4, nombreProducto: 'Photocard', nombreVariante: 'Estándar', cantidad: 4, subtotal: 60, personalizado: true },
        { idDetalleOrden: 5, nombreProducto: 'Llavero Personalizado', nombreVariante: 'Acrílico Cuadrado Mediano', cantidad: 2, subtotal: 60, personalizado: true }
      ]
    },
    {
      idOrden: 1045, codigoOrden: 'NTC-1045', nicknameComprador: 'diego_dev', telefonoComprador: '+50255500011',
      areaEntrega: 'Edificio principal', referenciaEntrega: 'Salón 305, tercer nivel',
      estado: 'LISTO_PARA_ENTREGA', total: 45, fechaCreacion: minutesAgo(60), qrUtilizado: false,
      pago: { metodo: 'TARJETA', estado: 'PAGADO', monto: 45 },
      items: [
        { idDetalleOrden: 6, nombreProducto: 'Llavero Personalizado', nombreVariante: 'Acrílico Circular Mediano', cantidad: 1, subtotal: 35, personalizado: true },
        { idDetalleOrden: 7, nombreProducto: 'Photocard', nombreVariante: 'Estándar', cantidad: 1, subtotal: 10, personalizado: true }
      ]
    },
    {
      idOrden: 1040, codigoOrden: 'NTC-1040', nicknameComprador: 'ana_t', telefonoComprador: '+50255577777',
      areaEntrega: 'Cafeteria', referenciaEntrega: 'Mesa del fondo',
      estado: 'ENTREGADO', total: 35, fechaCreacion: minutesAgo(300), qrUtilizado: true,
      pago: { metodo: 'EFECTIVO', estado: 'PAGADO', monto: 35 },
      items: [
        { idDetalleOrden: 8, nombreProducto: 'Llavero Personalizado', nombreVariante: 'Acrílico Circular Mediano', cantidad: 1, subtotal: 35, personalizado: true }
      ],
      ultimoIntento: { resultado: 'ENTREGADO', fechaHoraFin: minutesAgo(30), observacion: null, fotoFileId: null }
    }
  ]
}

function apiError(status: number, message: string): ApiError {
  return { status, code: `MOCK_${status}`, message }
}

export function createMockDeliveryService(): DeliveryService {
  // Estado compartido por la app (se reinicia al recargar).
  const state = useState<DeliveryOrderDto[]>('nt-mock-delivery', seed)

  const clone = <T>(v: T): T => structuredClone(toRaw(v))
  const find = (id: number) => {
    const o = state.value.find(x => x.idOrden === id)
    if (!o) throw apiError(404, 'La orden no existe o no está asignada a ti.')
    return o
  }
  const qrOf = (o: DeliveryOrderDto) => `NT-${o.codigoOrden}`

  return {
    async listAssigned() {
      await delay()
      return clone(state.value)
    },

    async getOrder(id) {
      await delay(300)
      return clone(find(id))
    },

    async startDelivery(id) {
      await delay()
      const o = find(id)
      if (o.estado !== 'LISTO_PARA_ENTREGA') throw apiError(409, 'Esta orden ya no está lista para entrega.')
      o.estado = 'EN_ENTREGA'
      return clone(o)
    },

    async validateOrderQr(id, qr) {
      await delay(500)
      const o = find(id)
      if (o.qrUtilizado) return { ok: false, message: 'Este QR ya fue utilizado.' }
      if (qr.trim() !== qrOf(o)) return { ok: false, message: 'El QR no corresponde a esta orden.' }
      o.qrUtilizado = true
      return { ok: true, message: 'QR verificado: es el comprador correcto.' }
    },

    async findByQr(qr) {
      await delay(400)
      const o = state.value.find(x => qrOf(x) === qr.trim())
      return o ? clone(o) : null
    },

    async complete(id, body) {
      await delay(700)
      const o = find(id)
      if (o.estado !== 'EN_ENTREGA') throw apiError(409, 'Inicia la entrega antes de confirmarla.')
      if (!o.qrUtilizado) throw apiError(422, 'Verifica el QR del comprador antes de confirmar.')
      if (o.pago.metodo === 'EFECTIVO' && (body.montoRecibido ?? 0) < o.total) {
        throw apiError(422, 'El monto recibido es menor al total.')
      }
      o.estado = 'ENTREGADO'
      o.pago.estado = 'PAGADO'
      o.ultimoIntento = { resultado: 'ENTREGADO', fechaHoraFin: new Date().toISOString(), observacion: body.observacion ?? null, fotoFileId: body.fotoFileId }
      return clone(o)
    },

    async reportFailed(id, body) {
      await delay(700)
      const o = find(id)
      if (o.estado !== 'EN_ENTREGA') throw apiError(409, 'Inicia la entrega antes de reportar un problema.')
      o.estado = body.resultado === 'COMPRADOR_NO_ENCONTRADO' ? 'COMPRADOR_NO_ENCONTRADO' : 'LISTO_PARA_ENTREGA'
      if (body.resultado === 'PAGO_NO_REALIZADO') o.pago.estado = 'RECHAZADO'
      o.ultimoIntento = { resultado: body.resultado, fechaHoraFin: new Date().toISOString(), observacion: body.observacion, fotoFileId: body.fotoFileId ?? null }
      return clone(o)
    }
  }
}
