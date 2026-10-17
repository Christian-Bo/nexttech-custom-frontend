import type { OrdenDetalleApi } from './trackingService'
import * as signalR from '@microsoft/signalr'

/** Hub exclusivo de compradores: los JWT internos no se utilizan aquí. */
export async function connectOrderTracking(options: {
  apiBase: string
  codigoOrden: string
  token: () => string | null
  onOrder: (payload: OrdenDetalleApi) => void
  onReconnect: () => void
  onConnected: () => void
  onRefresh: () => void
  onError: (message: string) => void
}): Promise<() => Promise<void>> {
  const connection = new signalR.HubConnectionBuilder()
    .withUrl(`${options.apiBase.replace(/\/$/, '')}/hubs/tracking`, { accessTokenFactory: () => options.token() ?? '' })
    .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
    .configureLogging(signalR.LogLevel.Warning)
    .build()

  const join = async () => {
    try { await connection.invoke('UnirseAPedido', options.codigoOrden) }
    catch (e) {
      const message = e instanceof Error ? e.message : ''
      const canonical = ['El código de la orden es obligatorio.', 'La orden no existe.', 'No puedes seguir esta orden.']
        .find(text => message.includes(text))
      options.onError(canonical ?? 'No se pudo suscribir al seguimiento de esta orden.')
      throw e
    }
  }
  connection.on('pedidoActualizado', options.onOrder)
  connection.onreconnecting(() => { options.onReconnect(); options.onRefresh() })
  connection.onreconnected(async () => {
    try { await join(); options.onConnected(); options.onRefresh() }
    catch { options.onReconnect() }
  })
  connection.onclose(() => { options.onReconnect(); options.onRefresh() })
  try {
    await connection.start()
    await join()
  }
  catch (e) {
    await connection.stop()
    throw e
  }
  return async () => { await connection.stop() }
}
