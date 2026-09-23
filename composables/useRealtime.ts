import { getCurrentScope, onScopeDispose, readonly } from 'vue'
import type { RealtimeEventName, RealtimeEvents, RealtimeStatus } from '~/types/realtime'
import { onMockEvent, useMockOrders } from '~/services/mock/mockOrders'
import { useAuthStore } from '~/stores/auth'

/**
 * Conexión de tiempo real ÚNICA para toda la app (client-only).
 * - Transporte real: SignalR con reconexión automática y JWT.
 * - Transporte mock: simulador local (runtimeConfig.public.useMocks).
 * Cada `on()` se desuscribe solo al desmontar; la conexión se cierra
 * cuando ya nadie la usa (conteo de referencias) => sin duplicados ni fugas.
 */

type Handler = (payload: unknown) => void

interface Transport {
  start: () => Promise<void>
  stop: () => Promise<void>
  invoke: (method: string, ...args: unknown[]) => Promise<void>
}

const EVENTS: RealtimeEventName[] = ['OrderStatusChanged', 'OrderCreated']
const handlers = new Map<RealtimeEventName, Set<Handler>>()
let transport: Transport | null = null
let refCount = 0
let starting: Promise<void> | null = null

function dispatch(event: RealtimeEventName, payload: unknown): void {
  handlers.get(event)?.forEach(h => h(payload))
}

function createMockTransport(setStatus: (s: RealtimeStatus) => void): Transport {
  const mock = useMockOrders()
  let timer: ReturnType<typeof setInterval> | null = null
  let off: (() => void) | null = null
  return {
    async start() {
      setStatus('connecting')
      await new Promise(r => setTimeout(r, 500))
      off = onMockEvent(dispatch)
      timer = setInterval(mock.tick, 9000)
      setStatus('connected')
    },
    async stop() {
      if (timer) clearInterval(timer)
      off?.()
      timer = null
      off = null
      setStatus('disconnected')
    },
    async invoke() {}
  }
}

async function createSignalRTransport(url: string, getToken: () => string | null, setStatus: (s: RealtimeStatus) => void): Promise<Transport> {
  const signalR = await import('@microsoft/signalr')
  const connection = new signalR.HubConnectionBuilder()
    .withUrl(url, { accessTokenFactory: () => getToken() ?? '' })
    .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
    .configureLogging(signalR.LogLevel.Warning)
    .build()

  for (const event of EVENTS) connection.on(event, (payload: unknown) => dispatch(event, payload))
  connection.onreconnecting(() => setStatus('reconnecting'))
  connection.onreconnected(() => setStatus('connected'))
  connection.onclose(() => setStatus('disconnected'))

  return {
    async start() {
      setStatus('connecting')
      try {
        await connection.start()
        setStatus('connected')
      }
      catch {
        setStatus('disconnected')
      }
    },
    async stop() {
      await connection.stop()
    },
    async invoke(method, ...args) {
      if (connection.state === signalR.HubConnectionState.Connected) await connection.invoke(method, ...args)
    }
  }
}

export function useRealtime() {
  const status = useState<RealtimeStatus>('nt-realtime-status', () => 'idle')
  const config = useRuntimeConfig()
  const auth = useAuthStore()
  const setStatus = (s: RealtimeStatus) => (status.value = s)

  async function connect(): Promise<void> {
    if (!import.meta.client) return
    if (transport && status.value !== 'disconnected') return
    if (starting) return starting
    starting = (async () => {
      transport ??= config.public.useMocks
        ? createMockTransport(setStatus)
        : await createSignalRTransport(`${config.public.apiBase}${config.public.realtimeHubPath}`, () => auth.accessToken, setStatus)
      await transport.start()
    })().finally(() => (starting = null))
    return starting
  }

  async function release(): Promise<void> {
    refCount = Math.max(0, refCount - 1)
    if (refCount === 0 && transport) {
      await transport.stop()
      transport = null
      setStatus('idle')
    }
  }

  /** Suscribe a un evento. Devuelve la función para desuscribirse (también automática). */
  function on<K extends RealtimeEventName>(event: K, handler: (payload: RealtimeEvents[K]) => void): () => void {
    const set = handlers.get(event) ?? new Set<Handler>()
    handlers.set(event, set)
    set.add(handler as Handler)
    refCount++
    void connect()
    let active = true
    const off = () => {
      if (!active) return
      active = false
      set.delete(handler as Handler)
      void release()
    }
    if (getCurrentScope()) onScopeDispose(off)
    return off
  }

  /** Llama un método del hub (p. ej. unirse al grupo de una orden). */
  async function invoke(method: string, ...args: unknown[]): Promise<void> {
    await transport?.invoke(method, ...args)
  }

  /** Reintento manual tras desconexión. */
  async function reconnect(): Promise<void> {
    if (transport) await transport.start()
    else await connect()
  }

  return { status: readonly(status), on, invoke, reconnect }
}
