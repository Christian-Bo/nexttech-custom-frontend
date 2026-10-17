<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { CheckoutResult } from '~/features/orders/types/orders'
import { readPendingCheckout, clearPendingCheckout } from '~/features/orders/services/recurrenteSession'
import { useOrdersService } from '~/features/orders/services/ordersService'
import { useReceiptService } from '~/features/tracking/services/receiptService'
import { isApiError } from '~/services/api'
import { formatQ } from '~/utils/format'

definePageMeta({
  middleware: [() => {
    // Una redirección desde Recurrente puede omitir inicialmente cookies SameSite=Strict
    // en la solicitud de SSR; comprobar la sesión ya desde el navegador.
    if (import.meta.server || useRuntimeConfig().public.useMocks) return
    if (!useAuthStore().isBuyer) return navigateTo({ path: '/login', query: { redirect: useRoute().fullPath } })
  }]
})
useHead({ title: 'Confirmar pago · NextTech Custom' })

const route = useRoute()
const auth = useAuthStore()
const orders = useOrdersService()
const receipt = useReceiptService()
const cart = useCartStore()
const loading = ref(true)
const message = ref('')
const result = ref<CheckoutResult | null>(null)
const downloadingReceipt = ref(false)

function resolveCheckoutId(): string {
  const value = route.query.checkout_id
  const fromQuery = typeof value === 'string' ? value.trim() : ''
  return fromQuery || readPendingCheckout(auth.buyerId)?.checkoutId || ''
}

async function confirmPayment(): Promise<void> {
  const id = resolveCheckoutId()
  if (!id) {
    message.value = 'No se encontró el identificador del pago. Revisa tus pedidos o regresa al checkout.'
    loading.value = false
    return
  }
  loading.value = true
  message.value = ''
  try {
    const order = await orders.confirmCard(id)
    result.value = order
    clearPendingCheckout(id)
    try { await cart.load() } catch { /* La orden ya existe aunque falle la recarga del carrito. */ }
  }
  catch (e) {
    message.value = isApiError(e) ? e.message : 'Todavía no podemos confirmar el pago. Puedes volver a verificarlo.'
  }
  finally {
    loading.value = false
  }
}

async function downloadReceipt(): Promise<void> {
  if (!result.value || downloadingReceipt.value) return
  downloadingReceipt.value = true
  try { await receipt.download(result.value.codigoOrden) }
  catch (e) { message.value = isApiError(e) ? e.message : 'No se pudo descargar la constancia.' }
  finally { downloadingReceipt.value = false }
}

onMounted(confirmPayment)
</script>

<template>
  <v-container class="py-8" style="max-width: 760px">
    <v-card color="surface" rounded="xl" class="pa-5 pa-sm-8 text-center">
      <template v-if="loading">
        <v-progress-circular indeterminate color="secondary" size="58" class="my-5" />
        <h1 class="text-h5 font-weight-bold">Verificando tu pago</h1>
        <p class="text-medium-emphasis mt-2">Estamos consultando Recurrente y confirmando la orden en NextTech.</p>
      </template>

      <template v-else-if="result">
        <v-icon icon="mdi-check-circle-outline" color="success" size="64" class="mb-3" />
        <h1 class="text-h5 font-weight-bold">¡Pedido confirmado!</h1>
        <p class="text-medium-emphasis mt-2">Tu pago fue validado y la orden ya está registrada.</p>
        <p class="text-h6 mt-4" style="overflow-wrap: anywhere">{{ result.codigoOrden }}</p>
        <p class="text-subtitle-1">{{ formatQ(result.total) }}</p>
        <div class="d-flex flex-wrap ga-3 justify-center mt-5">
          <v-btn color="primary" :to="`/seguimiento/${encodeURIComponent(result.codigoOrden)}`" prepend-icon="mdi-map-marker-path" class="text-none">Seguimiento</v-btn>
          <v-btn variant="tonal" prepend-icon="mdi-file-download-outline" :loading="downloadingReceipt" class="text-none" @click="downloadReceipt">Constancia PDF</v-btn>
          <v-btn to="/mis-pedidos" variant="text" class="text-none">Mis pedidos</v-btn>
        </div>
        <v-alert v-if="message" type="warning" variant="tonal" class="mt-4">{{ message }}</v-alert>
      </template>

      <template v-else>
        <v-icon icon="mdi-clock-alert-outline" color="warning" size="58" class="mb-3" />
        <h1 class="text-h5 font-weight-bold">Aún no se ha confirmado la orden</h1>
        <v-alert type="warning" variant="tonal" class="mt-4 text-left">{{ message }}</v-alert>
        <p class="text-body-2 text-medium-emphasis mt-3">Si ya pagaste, no inicies otro cobro antes de revisar el estado.</p>
        <div class="d-flex flex-wrap ga-3 justify-center mt-5">
          <v-btn color="primary" :loading="loading" class="text-none" @click="confirmPayment">Volver a verificar</v-btn>
          <v-btn to="/mis-pedidos" variant="tonal" class="text-none">Mis pedidos</v-btn>
          <v-btn to="/checkout" variant="text" class="text-none">Ir al checkout</v-btn>
        </div>
      </template>
    </v-card>
  </v-container>
</template>
