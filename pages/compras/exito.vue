<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { OrderCreated } from '~/features/orders/types/orders'
import { readPendingCheckout } from '~/features/orders/types/orders'
import { useOrdersService } from '~/features/orders/services/ordersService'
import { useReceiptService } from '~/features/tracking/services/receiptService'
import { isApiError } from '~/services/api'
import type { ApiError } from '~/types/api'
import { formatQ } from '~/utils/format'

definePageMeta({
  middleware: [
    (to) => {
      if (useRuntimeConfig().public.useMocks) return
      if (!useAuthStore().isBuyer) return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
    }
  ]
})
useHead({ title: 'Pago confirmado · NextTech Custom' })

/** Intentos de confirmación: el webhook del proveedor puede tardar unos segundos. */
const MAX_ATTEMPTS = 3
const RETRY_MS = 2500

const route = useRoute()
const cart = useCartStore()
const snackbar = useSnackbar()
const orders = useOrdersService()
const receipt = useReceiptService()

type Phase = 'confirming' | 'done' | 'error' | 'missing'

const phase = ref<Phase>('confirming')
const attempt = ref(0)
const order = ref<OrderCreated | null>(null)
const error = ref<ApiError | null>(null)
const downloadingReceipt = ref(false)

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

/**
 * El id del pago puede venir en la URL (el nombre del parámetro depende del proveedor)
 * o del respaldo que guardamos antes de salir del checkout.
 */
function resolveCheckoutId(): string | null {
  for (const key of ['checkout_id', 'checkoutId', 'id']) {
    const value = route.query[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return readPendingCheckout()
}

async function confirm(): Promise<void> {
  const checkoutId = resolveCheckoutId()
  if (!checkoutId) {
    phase.value = 'missing'
    return
  }

  phase.value = 'confirming'
  error.value = null

  for (let i = 1; i <= MAX_ATTEMPTS; i++) {
    attempt.value = i
    try {
      order.value = await orders.confirmCard(checkoutId)
      await cart.load()
      phase.value = 'done'
      return
    }
    catch (e) {
      const apiError: ApiError = isApiError(e)
        ? e
        : { status: 0, code: 'UNKNOWN', message: 'No pudimos confirmar tu pago.' }

      // 400 = el proveedor todavía no marcó el pago como pagado. Vale la pena reintentar.
      if (apiError.status === 400 && i < MAX_ATTEMPTS) {
        await delay(RETRY_MS)
        continue
      }

      error.value = apiError
      phase.value = 'error'
      return
    }
  }
}

async function downloadReceipt(): Promise<void> {
  if (!order.value) return
  downloadingReceipt.value = true
  try {
    await receipt.download(order.value.codigoOrden)
  }
  catch (e) {
    snackbar.error(isApiError(e) ? e : 'No se pudo descargar la constancia.')
  }
  finally {
    downloadingReceipt.value = false
  }
}

onMounted(confirm)
</script>

<template>
  <v-container
    class="py-8"
    style="max-width: 760px"
  >
    <!-- Confirmando con el proveedor -->
    <div
      v-if="phase === 'confirming'"
      class="state"
    >
      <v-progress-circular
        indeterminate
        size="64"
        width="5"
        color="accent"
      />
      <h1 class="text-h5 font-weight-bold mt-6">
        Estamos confirmando tu pago
      </h1>
      <p class="text-medium-emphasis mt-2">
        No cierres esta página. Puede tardar unos segundos.
      </p>
      <p
        v-if="attempt > 1"
        class="text-caption text-medium-emphasis mt-2"
      >
        Intento {{ attempt }} de {{ MAX_ATTEMPTS }}…
      </p>
    </div>

    <!-- Pago confirmado y orden creada -->
    <div
      v-else-if="phase === 'done' && order"
      class="state"
    >
      <div class="state__icon state__icon--ok">
        <v-icon
          icon="mdi-check-bold"
          size="44"
        />
      </div>
      <h1 class="text-h4 font-weight-bold mt-4">
        ¡Pago recibido!
      </h1>
      <p class="text-medium-emphasis mt-2">
        Tu pedido ya entró a elaboración. Te avisaremos cuando esté listo para entrega.
      </p>
      <div class="state__code">
        <span class="text-caption text-medium-emphasis">Código de tu pedido</span>
        <strong>{{ order.codigoOrden }}</strong>
        <span class="text-body-2">{{ formatQ(order.total) }} · Pagado con tarjeta</span>
      </div>
      <div class="d-flex flex-wrap justify-center ga-3 mt-6">
        <v-btn
          color="primary"
          size="large"
          variant="flat"
          class="text-none"
          prepend-icon="mdi-map-marker-path"
          :to="`/seguimiento/${encodeURIComponent(order.codigoOrden)}`"
        >
          Seguir mi pedido
        </v-btn>
        <v-btn
          variant="tonal"
          size="large"
          class="text-none"
          prepend-icon="mdi-file-download-outline"
          :loading="downloadingReceipt"
          @click="downloadReceipt"
        >
          Constancia (PDF)
        </v-btn>
        <v-btn
          variant="text"
          size="large"
          class="text-none"
          to="/mis-pedidos"
        >
          Mis pedidos
        </v-btn>
      </div>
      <p class="text-caption text-medium-emphasis mt-4">
        También te enviamos la constancia con tu QR de entrega.
      </p>
    </div>

    <!-- No pudimos confirmar -->
    <div
      v-else-if="phase === 'error'"
      class="state"
    >
      <div class="state__icon state__icon--warn">
        <v-icon
          icon="mdi-clock-alert-outline"
          size="44"
        />
      </div>
      <h1 class="text-h5 font-weight-bold mt-4">
        Todavía no pudimos confirmar tu pago
      </h1>
      <p class="text-medium-emphasis mt-2">
        {{ error?.message }}
      </p>
      <p class="text-body-2 text-medium-emphasis mt-4">
        Si el cargo ya apareció en tu tarjeta, tu pedido se va a crear solo en cuanto el banco
        nos confirme. Revisá <strong>Mis pedidos</strong> en unos minutos antes de volver a pagar.
      </p>
      <div class="d-flex flex-wrap justify-center ga-3 mt-6">
        <v-btn
          color="primary"
          size="large"
          variant="flat"
          class="text-none"
          prepend-icon="mdi-refresh"
          @click="confirm"
        >
          Volver a intentar
        </v-btn>
        <v-btn
          variant="tonal"
          size="large"
          class="text-none"
          to="/mis-pedidos"
        >
          Mis pedidos
        </v-btn>
      </div>
      <p
        v-if="error?.traceId"
        class="text-caption text-medium-emphasis mt-4"
      >
        Referencia para soporte: {{ error.traceId }}
      </p>
    </div>

    <!-- Entró a la página sin un pago asociado -->
    <StateEmpty
      v-else
      icon="mdi-credit-card-off-outline"
      title="No encontramos un pago pendiente"
      description="Esta página confirma los pagos con tarjeta. Si acabás de comprar, buscá tu pedido en Mis pedidos."
    >
      <template #actions>
        <v-btn
          to="/mis-pedidos"
          color="primary"
          variant="flat"
          class="text-none"
        >
          Mis pedidos
        </v-btn>
        <v-btn
          to="/catalogo"
          variant="text"
          class="text-none ml-2"
        >
          Ver catálogo
        </v-btn>
      </template>
    </StateEmpty>
  </v-container>
</template>

<style scoped>
.state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 48px 16px;
}

.state__icon {
  display: grid;
  place-items: center;
  width: 88px;
  height: 88px;
  border-radius: 50%;
  color: #0f172a;
  animation: pop 0.5s cubic-bezier(0.2, 1.4, 0.4, 1);
}

.state__icon--ok {
  background: linear-gradient(135deg, #22c55e, #06b6d4);
  box-shadow: 0 0 40px -6px rgb(34 197 94 / 60%);
}

.state__icon--warn {
  background: linear-gradient(135deg, #f59e0b, #f97316);
  box-shadow: 0 0 40px -6px rgb(245 158 11 / 60%);
}

.state__code {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 24px;
  padding: 16px 32px;
  border-radius: 14px;
  border: 1px dashed rgb(6 182 212 / 60%);
  background: rgb(30 41 59 / 90%);
}

.state__code strong {
  font-size: 1.8rem;
  letter-spacing: 0.06em;
}

@keyframes pop {
  from { transform: scale(0.4); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
</style>