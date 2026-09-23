<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { ApiError } from '~/types/api'
import type { OrderTrackingDto } from '../types/tracking'
import { useTrackingService } from '../services/trackingService'
import OrderTimeline from './OrderTimeline.vue'
import DeliveryQrCard from './DeliveryQrCard.vue'
import { isApiError } from '~/services/api'
import { useMockOrders } from '~/services/mock/mockOrders'
import { formatDateTime, formatQ } from '~/utils/format'

/** Seguimiento del pedido en tiempo real (vista del comprador). */
const props = defineProps<{ codigoOrden: string }>()

const service = useTrackingService()
const realtime = useRealtime()
const snackbar = useSnackbar()
const config = useRuntimeConfig()

const order = ref<OrderTrackingDto | null>(null)
const loading = ref(true)
const error = ref<ApiError | null>(null)
const justChanged = ref(false)

const STATUS_TEXT: Record<string, string> = {
  EN_ELABORACION: 'Tu pedido entró a elaboración',
  LISTO_PARA_ENTREGA: '¡Tu pedido está listo para entrega!',
  EN_ENTREGA: 'Tu pedido va en camino',
  ENTREGADO: '¡Pedido entregado!',
  COMPRADOR_NO_ENCONTRADO: 'No pudimos entregarte tu pedido'
}

const headline = computed(() => {
  switch (order.value?.estado) {
    case 'ORDEN_GENERADA': return 'Recibimos tu pedido'
    case 'EN_ELABORACION': return 'Estamos fabricando tu pedido'
    case 'LISTO_PARA_ENTREGA': return 'Tu pedido está listo'
    case 'EN_ENTREGA': return 'Tu pedido va en camino'
    case 'ENTREGADO': return '¡Tu pedido fue entregado!'
    case 'COMPRADOR_NO_ENCONTRADO': return 'No pudimos entregarte'
    default: return ''
  }
})

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    order.value = await service.getByCode(props.codigoOrden)
  }
  catch (e) {
    error.value = isApiError(e) ? e : { status: 0, code: 'UNKNOWN', message: 'No se pudo cargar el pedido.' }
  }
  finally {
    loading.value = false
  }
}

// Tiempo real: el estado cambia sin recargar la página.
realtime.on('OrderStatusChanged', async (event) => {
  if (!order.value || event.codigoOrden !== order.value.codigoOrden) return
  order.value = await service.getByCode(props.codigoOrden)
  justChanged.value = true
  setTimeout(() => (justChanged.value = false), 1500)
  const text = STATUS_TEXT[event.estado]
  if (text) snackbar[event.estado === 'COMPRADOR_NO_ENCONTRADO' ? 'warning' : 'success'](text)
})

// Solo en modo simulado: para la demo.
const mock = config.public.useMocks ? useMockOrders() : null
function simulateAdvance(): void {
  if (!mock?.advanceByCode(props.codigoOrden)) snackbar.info('Este pedido ya no avanza más.')
}

onMounted(async () => {
  await load()
  // Unirse al grupo de la orden en el hub (nombre del método PROVISIONAL).
  if (order.value) void realtime.invoke('JoinOrderGroup', order.value.codigoOrden)
})
</script>

<template>
  <div>
    <v-skeleton-loader
      v-if="loading"
      type="heading, list-item-avatar-two-line@4"
    />

    <StateError
      v-else-if="error || !order"
      :error="error"
      :title="error?.status === 404 ? 'Pedido no encontrado' : 'Algo salió mal'"
      :retryable="error?.status !== 404"
      @retry="load"
    />

    <div
      v-else
      class="tracking"
    >
      <header class="tracking__header">
        <div>
          <div class="text-caption text-medium-emphasis">
            Pedido #{{ order.codigoOrden }} · {{ formatDateTime(order.fechaCreacion) }}
          </div>
          <h1
            class="text-h5 font-weight-bold"
            :class="{ 'flash': justChanged }"
          >
            {{ headline }}
          </h1>
        </div>
        <v-spacer />
        <RealtimeIndicator />
      </header>

      <div class="tracking__grid">
        <v-card
          border
          variant="flat"
          class="pa-5"
        >
          <OrderTimeline
            :estado="order.estado"
            :historial="order.historial"
          />
          <v-btn
            v-if="config.public.useMocks && !['ENTREGADO', 'COMPRADOR_NO_ENCONTRADO'].includes(order.estado)"
            size="small"
            variant="text"
            prepend-icon="mdi-play-circle-outline"
            class="mt-4"
            @click="simulateAdvance"
          >
            Simular avance (demo)
          </v-btn>
        </v-card>

        <div class="d-flex flex-column ga-4">
          <DeliveryQrCard
            v-if="order.qrEntrega"
            :value="order.qrEntrega"
            :codigo-orden="order.codigoOrden"
          />

          <v-card
            border
            variant="flat"
            class="pa-4"
          >
            <div class="text-overline mb-2">
              Punto de entrega
            </div>
            <div class="d-flex ga-3">
              <v-icon
                icon="mdi-map-marker-outline"
                color="accent"
              />
              <div>
                <div class="font-weight-medium">
                  {{ order.areaEntrega }}
                </div>
                <div class="text-body-2 text-medium-emphasis">
                  {{ order.referenciaEntrega }}
                </div>
              </div>
            </div>
          </v-card>

          <v-card
            border
            variant="flat"
            class="pa-4"
          >
            <div class="text-overline mb-2">
              Detalle
            </div>
            <div class="d-flex justify-space-between text-body-2 mb-1">
              <span>{{ order.cantidad }}× {{ order.producto }}</span>
              <span>{{ formatQ(order.total) }}</span>
            </div>
            <div class="d-flex justify-space-between text-body-2 text-medium-emphasis">
              <span>Pago</span>
              <span>{{ order.metodoPago === 'EFECTIVO' ? 'Efectivo al recibir' : 'Tarjeta' }}</span>
            </div>
          </v-card>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tracking__header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 20px;
}

.tracking__grid {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr);
  gap: 20px;
  align-items: start;
}

.flash {
  animation: flash 1.4s ease;
}

@keyframes flash {
  0% { color: var(--nt-accent); }
  100% { color: var(--nt-text); }
}

@media (max-width: 760px) {
  .tracking__grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
