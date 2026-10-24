<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { DeliveryArea } from '~/features/catalog/types/catalog'
import type { CheckoutResult, PaymentMethod, RecurrenteCheckoutSession } from '~/features/orders/types/orders'
import { isRecurrenteCheckoutSession } from '~/features/orders/types/orders'
import { savePendingCheckout, readPendingCheckout, clearPendingCheckout } from '~/features/orders/services/recurrenteSession'
import { useShopCatalog } from '~/features/catalog/services/catalogService'
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
useHead({ title: 'Finalizar compra · NextTech Custom' })

const auth = useAuthStore()
const useMocks = !!useRuntimeConfig().public.useMocks
const cart = useCartStore()
const snackbar = useSnackbar()
const catalog = useShopCatalog()
const orders = useOrdersService()
const receipt = useReceiptService()
const downloadingReceipt = ref(false)

async function downloadReceipt(): Promise<void> {
  if (!result.value) return
  downloadingReceipt.value = true
  try {
    await receipt.download(result.value.codigoOrden)
  }
  catch (e) {
    snackbar.error(isApiError(e) ? e : 'No se pudo descargar la constancia.')
  }
  finally {
    downloadingReceipt.value = false
  }
}

const REFERENCE_MAX = 200
const AREA_ICONS: Record<string, string> = {
  'entrada principal': 'mdi-gate',
  'cafeteria': 'mdi-coffee-outline',
  'biblioteca': 'mdi-bookshelf',
  'edificio principal': 'mdi-office-building-outline'
}

const areas = ref<DeliveryArea[]>([])
const areaId = ref<number | null>(null)
const reference = ref('')
const payment = ref<PaymentMethod>('EFECTIVO')
const loading = ref(true)
const submitting = ref(false)
const error = ref<ApiError | null>(null)
const result = ref<CheckoutResult | null>(null)
const pendingCard = ref<RecurrenteCheckoutSession | null>(null)
const confirmingCard = ref(false)
const cardMessage = ref('')

// Solo presentación del checkout: el servicio, método y contrato de pago no cambian.
const mobileStep = ref<1 | 2>(1)
const attemptedDelivery = ref(false)

const selectedArea = computed(() => areas.value.find(a => a.idAreaEntrega === areaId.value) ?? null)
const deliveryReady = computed(() => !!areaId.value && reference.value.trim().length >= 3)
const areaError = computed(() => attemptedDelivery.value && !areaId.value)
const referenceError = computed(() => attemptedDelivery.value && reference.value.trim().length < 3)
const canSubmit = computed(() =>
  deliveryReady.value && cart.items.length > 0 && !pendingCard.value && orders.paymentMethods.includes(payment.value)
)

function explainMissingDelivery(): void {
  attemptedDelivery.value = true
  mobileStep.value = 1
  if (!areaId.value) {
    snackbar.error('Selecciona dónde debemos entregarte el pedido.')
  }
  else if (reference.value.trim().length < 3) {
    snackbar.error('Escribe una referencia de al menos 3 caracteres para encontrarte.')
  }
}

function continueToPayment(): void {
  if (!deliveryReady.value) {
    explainMissingDelivery()
    return
  }
  attemptedDelivery.value = false
  mobileStep.value = 2
  if (import.meta.client) window.scrollTo({ top: 0, behavior: 'smooth' })
}

function submitWithFeedback(): void {
  if (submitting.value || pendingCard.value) return
  if (!cart.items.length) {
    snackbar.warning('El carrito está vacío. Agrega un producto para continuar.')
    return
  }
  if (!deliveryReady.value) {
    explainMissingDelivery()
    return
  }
  if (!orders.paymentMethods.includes(payment.value)) {
    snackbar.error('Selecciona un método de pago disponible para continuar.')
    return
  }
  // Se llama al mismo submit() que ya protege de duplicación de órdenes/pagos.
  void submit()
}

function mobileAction(): void {
  if (mobileStep.value === 1) {
    continueToPayment()
  }
  else {
    submitWithFeedback()
  }
}

function areaIcon(nombre: string): string {
  return AREA_ICONS[nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()] ?? 'mdi-map-marker-outline'
}

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    // Si Recurrente redirige o se recarga la página, no crear un segundo checkout.
    const previous = readPendingCheckout(auth.buyerId)
    if (previous && !useMocks) {
      pendingCard.value = previous
      payment.value = 'TARJETA'
    }
    const [list] = await Promise.all([catalog.listDeliveryAreas(), cart.load()])
    areas.value = list
  }
  catch (e) {
    error.value = isApiError(e) ? e : { status: 0, code: 'UNKNOWN', message: 'No se pudo preparar la compra.' }
  }
  finally {
    loading.value = false
  }
}

async function confirmCard(checkoutId: string): Promise<void> {
  const pending = pendingCard.value
  if (!pending || confirmingCard.value) return
  if (checkoutId !== pending.checkoutId) {
    cardMessage.value = 'La referencia devuelta por Recurrente no coincide con la sesión iniciada.'
    return
  }
  confirmingCard.value = true
  cardMessage.value = ''
  try {
    // El backend comprueba el pago. Hasta aquí NO se crea la orden.
    result.value = await orders.confirmCard(pending.checkoutId)
    clearPendingCheckout(pending.checkoutId)
    pendingCard.value = null
    try { await cart.load() } catch { /* Orden ya confirmada; no revertir éxito por recarga. */ }
  }
  catch (e) {
    const message = isApiError(e) ? e.message : 'No se pudo confirmar el pago. Reinténtalo antes de crear otro checkout.'
    cardMessage.value = message
    snackbar.error(isApiError(e) ? e : message)
  }
  finally {
    confirmingCard.value = false
  }
}

function discardPendingCard(): void {
  if (!pendingCard.value || confirmingCard.value) return
  if (!window.confirm('Esta acción solo descarta la sesión en esta pantalla. Si ya pagaste, NO generes otro cobro: entra a Mis pedidos o utiliza el enlace de confirmación. ¿Deseas continuar?')) return
  clearPendingCheckout(pendingCard.value.checkoutId)
  pendingCard.value = null
  cardMessage.value = ''
}

async function submit(): Promise<void> {
  if (!canSubmit.value || !areaId.value || submitting.value) return
  submitting.value = true
  try {
    const response = await orders.checkout({ idAreaEntrega: areaId.value, referenciaEntrega: reference.value, metodoPago: payment.value })
    if (isRecurrenteCheckoutSession(response)) {
      // Guardamos checkoutId ANTES de montar el widget; si el navegador bloquea
      // sessionStorage, conservamos la sesión en memoria y la URL de retorno.
      if (auth.buyerId !== null) {
        try { savePendingCheckout(auth.buyerId, response) }
        catch { snackbar.error('No fue posible guardar temporalmente la sesión de pago en este navegador.') }
      }
      pendingCard.value = response
      cardMessage.value = ''
      return
    }
    result.value = response
    await cart.load()
  }
  catch (e) {
    snackbar.error(isApiError(e) ? e : 'No se pudo completar la compra.')
  }
  finally {
    submitting.value = false
  }
}


onMounted(load)
</script>

<template>
  <v-container
    class="py-8"
    style="max-width: 1100px"
  >
    <!-- Compra confirmada -->
    <div
      v-if="result"
      class="done"
    >
      <div class="done__icon">
        <v-icon
          icon="mdi-check-bold"
          size="44"
        />
      </div>
      <h1 class="text-h4 font-weight-bold mt-4">
        ¡Pedido confirmado!
      </h1>
      <p class="text-medium-emphasis mt-2">
        Ya lo estamos preparando. Te avisaremos cuando esté listo para entrega.
      </p>
      <div class="done__code">
        <span class="text-caption text-medium-emphasis">Código de tu pedido</span>
        <strong>{{ result.codigoOrden }}</strong>
        <span class="text-body-2">{{ formatQ(result.total) }} · {{ payment === 'EFECTIVO' ? 'Pagas en efectivo al recibir' : 'Tarjeta' }}</span>
      </div>
      <div class="d-flex flex-wrap justify-center ga-3 mt-6">
        <v-btn
          color="primary"
          size="large"
          class="text-none"
          prepend-icon="mdi-map-marker-path"
          :to="`/seguimiento/${encodeURIComponent(result.codigoOrden)}`"
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
        También te enviamos la constancia con tu QR de entrega a tu correo.
      </p>
    </div>

    <div v-else-if="pendingCard" class="payment-pending">
      <v-btn variant="text" prepend-icon="mdi-arrow-left" class="text-none mb-3" @click="discardPendingCard">
        Volver a métodos de pago
      </v-btn>
      <h1 class="text-h5 font-weight-bold mb-2">Completa tu pago con tarjeta</h1>
      <p class="text-body-2 text-medium-emphasis mb-4">
        Total {{ formatQ(pendingCard.total) }} · {{ pendingCard.moneda }}. La orden se creará únicamente al confirmar el pago.
      </p>
      <v-alert v-if="cardMessage" type="warning" variant="tonal" class="mb-4">{{ cardMessage }}</v-alert>
      <v-progress-linear v-if="confirmingCard" indeterminate color="secondary" class="mb-4" />
      <RecurrenteCheckoutWidget
        :key="pendingCard.checkoutId"
        :checkout-id="pendingCard.checkoutId"
        :checkout-url="pendingCard.checkoutUrl"
        @success="confirmCard"
        @failure="cardMessage = $event"
        @pending="cardMessage = 'Tu pago está en proceso. Espera la confirmación antes de volver a intentarlo.'"
      />
      <div class="d-flex flex-wrap ga-2 mt-4">
        <v-btn color="secondary" variant="tonal" :loading="confirmingCard" @click="confirmCard(pendingCard.checkoutId)">
          Verificar pago
        </v-btn>
        <v-btn variant="text" to="/mis-pedidos">Mis pedidos</v-btn>
      </div>
    </div>

    <template v-else>
      <v-btn
        to="/carrito"
        variant="text"
        prepend-icon="mdi-arrow-left"
        class="text-none mb-2 px-2"
      >
        Carrito
      </v-btn>
      <h1 class="text-h4 font-weight-bold mb-6 checkout__heading">
        Finalizar compra
      </h1>

      <v-skeleton-loader
        v-if="loading"
        type="article, actions"
      />

      <StateError
        v-else-if="error"
        :error="error"
        @retry="load"
      />

      <StateEmpty
        v-else-if="cart.items.length === 0"
        icon="mdi-cart-outline"
        title="No hay productos para comprar"
        description="Agrega algo al carrito primero."
      >
        <template #actions>
          <v-btn
            to="/catalogo"
            color="primary"
            class="text-none"
          >
            Ver catálogo
          </v-btn>
        </template>
      </StateEmpty>

      <div
        v-else
        class="layout"
      >
        <div class="steps">
          <nav class="checkout__progress" aria-label="Pasos para finalizar la compra">
            <button
              type="button"
              class="checkout__progress-item"
              :class="{ 'checkout__progress-item--current': mobileStep === 1 }"
              :aria-current="mobileStep === 1 ? 'step' : undefined"
              @click="mobileStep = 1"
            >
              <span>1</span> Entrega
            </button>
            <v-icon icon="mdi-chevron-right" size="16" />
            <button
              type="button"
              class="checkout__progress-item"
              :class="{ 'checkout__progress-item--current': mobileStep === 2 }"
              :aria-current="mobileStep === 2 ? 'step' : undefined"
              :disabled="!deliveryReady"
              @click="continueToPayment"
            >
              <span>2</span> Pago y resumen
            </button>
          </nav>
          <!-- 1. Entrega -->
          <section class="step" :class="{ 'checkout__panel--inactive': mobileStep !== 1 }">
            <h2 class="step__title">
              <span class="step__num">1</span> ¿Dónde te lo entregamos?
            </h2>
            <v-alert
              v-if="areaError"
              type="warning"
              variant="tonal"
              density="compact"
              class="mb-3 checkout__inline-warning"
              role="alert"
            >
              Falta seleccionar dónde te entregaremos el pedido.
            </v-alert>
            <div
              class="areas"
              role="radiogroup"
              aria-label="Área de entrega"
            >
              <button
                v-for="a in areas"
                :key="a.idAreaEntrega"
                type="button"
                role="radio"
                :aria-checked="areaId === a.idAreaEntrega"
                class="area"
                :class="{ 'area--on': areaId === a.idAreaEntrega }"
                @click="areaId = a.idAreaEntrega"
              >
                <v-icon
                  :icon="areaIcon(a.nombre)"
                  size="28"
                />
                <span class="font-weight-bold">{{ a.nombre }}</span>
                <span
                  v-if="a.descripcion"
                  class="area__description text-caption text-medium-emphasis"
                >{{ a.descripcion }}</span>
              </button>
            </div>
            <p v-if="selectedArea?.descripcion" class="checkout__selected-description text-caption text-medium-emphasis mt-2 mb-0">
              {{ selectedArea.descripcion }}
            </p>
            <v-textarea
              v-model="reference"
              class="mt-3"
              label="Referencia para encontrarte"
              placeholder="Ej.: mesa junto a la ventana, suéter azul"
              variant="outlined"
              rows="2"
              auto-grow
              :counter="REFERENCE_MAX"
              :maxlength="REFERENCE_MAX"
              :error="referenceError"
              :error-messages="referenceError ? ['Escribe una referencia (mínimo 3 caracteres).'] : []"
              :hint="attemptedDelivery ? undefined : 'Ejemplo: frente a biblioteca, llevo mochila azul.'"
            />
          </section>

          <!-- 2. Pago -->
          <section class="step" :class="{ 'checkout__panel--inactive': mobileStep !== 2 }">
            <button type="button" class="checkout__back" @click="mobileStep = 1">
              <v-icon icon="mdi-arrow-left" size="16" /> Cambiar punto de entrega
            </button>
            <h2 class="step__title">
              <span class="step__num">2</span> ¿Cómo vas a pagar?
            </h2>
            <v-radio-group
              v-model="payment"
              class="checkout__payment-methods"
              hide-details
            >
              <v-radio value="EFECTIVO" :disabled="!orders.paymentMethods.includes('EFECTIVO')">
                <template #label>
                  <div>
                    <div class="font-weight-bold">
                      Efectivo
                    </div>
                    <div class="text-caption text-medium-emphasis">
                      Pagas al repartidor cuando recibes tu pedido.
                    </div>
                  </div>
                </template>
              </v-radio>
              <v-radio
                value="TARJETA"
                :disabled="!orders.paymentMethods.includes('TARJETA')"
                class="mt-2"
              >
                <template #label>
                  <div>
                    <div class="font-weight-bold">
                      Tarjeta de crédito o débito
                    </div>
                    <div class="text-caption text-medium-emphasis">
                      {{ useMocks ? 'Pago de demostración; no se realizará un cobro.' : orders.paymentMethods.includes('TARJETA') ? 'Pago seguro con Recurrente.' : 'Disponible pronto.' }}
                    </div>
                  </div>
                </template>
              </v-radio>
            </v-radio-group>
            <details class="checkout__mobile-order">
              <summary>
                <v-icon icon="mdi-receipt-text-outline" size="20" />
                Ver resumen del pedido
                <strong>{{ formatQ(cart.total) }}</strong>
                <v-icon icon="mdi-chevron-down" size="18" />
              </summary>
              <ul class="summary__items mt-3">
                <li v-for="i in cart.items" :key="i.idDetalleCarrito">
                  <span>{{ i.cantidad }} × {{ i.nombreProducto }} ({{ i.nombreVariante }})</span>
                  <span>{{ formatQ(i.subtotal) }}</span>
                </li>
              </ul>
              <v-divider class="my-3" />
              <div class="summary__row"><span>Entrega</span><span>{{ selectedArea?.nombre ?? '—' }}</span></div>
              <div class="summary__row summary__total"><span>Total</span><span>{{ formatQ(cart.total) }}</span></div>
            </details>
          </section>
        </div>

        <!-- Resumen -->
        <aside class="summary">
          <h2 class="text-subtitle-1 font-weight-bold mb-3">
            Tu pedido
          </h2>
          <ul class="summary__items">
            <li
              v-for="i in cart.items"
              :key="i.idDetalleCarrito"
            >
              <span>{{ i.cantidad }} × {{ i.nombreProducto }} <span class="text-medium-emphasis">({{ i.nombreVariante }})</span></span>
              <span>{{ formatQ(i.subtotal) }}</span>
            </li>
          </ul>
          <v-divider class="my-3" />
          <div class="summary__row">
            <span>Entrega</span>
            <span>{{ selectedArea?.nombre ?? '—' }}</span>
          </div>
          <div class="summary__row summary__total">
            <span>Total</span>
            <span>{{ formatQ(cart.total) }}</span>
          </div>
          <v-btn
            color="primary"
            size="large"
            block
            class="text-none mt-4 summary__desktop-submit"
            prepend-icon="mdi-check"
            :disabled="submitting || !!pendingCard"
            :loading="submitting"
            @click="submitWithFeedback"
          >
            {{ payment === 'TARJETA' && !useMocks ? 'Continuar a pago seguro' : 'Confirmar pedido' }}
          </v-btn>
          <p class="text-caption text-medium-emphasis mt-2 text-center">
            {{ deliveryReady ? 'Verifica los datos antes de confirmar.' : 'Selecciona un punto de entrega y agrega una referencia.' }}
          </p>
        </aside>
        <div v-if="cart.items.length > 0 && !loading && !error" class="checkout__mobile-submit" aria-label="Confirmar compra">
          <div class="checkout__mobile-total"><span>Total</span><strong>{{ formatQ(cart.total) }}</strong></div>
          <v-btn
            color="primary"
            class="text-none"
            :disabled="submitting || !!pendingCard"
            :loading="submitting"
            @click="mobileAction"
          >
            {{ mobileStep === 1 ? 'Continuar a pago' : payment === 'TARJETA' && !useMocks ? 'Pago seguro' : 'Confirmar pedido' }}
          </v-btn>
        </div>
      </div>
    </template>
  </v-container>
</template>

<style scoped>
.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 24px;
  align-items: start;
}

.steps {
  display: grid;
  gap: 20px;
}

.step,
.summary {
  padding: 20px;
  border-radius: 16px;
  border: 1px solid rgb(148 163 184 / 25%);
  background: rgb(30 41 59 / 90%);
}

.step__title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 1.1rem;
  font-weight: 700;
  margin-bottom: 16px;
}

.step__num {
  display: inline-grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  font-size: 0.85rem;
  color: #0f172a;
  background: var(--nt-accent);
}

.areas {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
}

.area {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 14px;
  text-align: left;
  color: inherit;
  border-radius: 12px;
  border: 1px solid rgb(148 163 184 / 30%);
  background: rgb(15 23 42 / 60%);
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
}

.area:hover {
  transform: translateY(-2px);
  border-color: rgb(6 182 212 / 60%);
}

.area--on {
  border-color: var(--nt-accent);
  box-shadow: 0 0 0 2px rgb(6 182 212 / 35%);
}

.summary {
  position: sticky;
  top: 80px;
}

.summary__items {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 8px;
  font-size: 0.9rem;
}

.summary__items li,
.summary__row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.summary__row {
  margin-bottom: 6px;
  color: var(--nt-text-secondary);
}

.summary__total {
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--nt-text);
}

.done {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 48px 16px;
}

.done__icon {
  display: grid;
  place-items: center;
  width: 88px;
  height: 88px;
  border-radius: 50%;
  color: #0f172a;
  background: linear-gradient(135deg, #22c55e, #06b6d4);
  box-shadow: 0 0 40px -6px rgb(34 197 94 / 60%);
  animation: pop 0.5s cubic-bezier(0.2, 1.4, 0.4, 1);
}

.done__code {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 24px;
  padding: 16px 32px;
  border-radius: 14px;
  border: 1px dashed rgb(6 182 212 / 60%);
  background: rgb(30 41 59 / 90%);
}

.done__code strong {
  font-size: 1.8rem;
  letter-spacing: 0.06em;
}

@keyframes pop {
  from { transform: scale(0.4); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

@media (max-width: 900px) {
  .layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .summary {
    position: static;
  }
}

/* Compra: sin desbordamientos en textos y acciones de móvil. */
.layout, .summary, .area { min-inline-size: 0; }
.summary__items li > span:first-child,
.summary__row > span { min-inline-size: 0; overflow-wrap: anywhere; }
.done__code { max-inline-size: 100%; overflow-wrap: anywhere; }
@media (max-width: 600px) {
  .done { padding: 24px 4px; }
  .done__code { inline-size: 100%; padding: 16px; }
  .done__code strong { font-size: clamp(1.15rem, 5vw, 1.8rem); overflow-wrap: anywhere; }
  .summary { position: static; }
}

.payment-pending { max-width: 760px; margin: 0 auto; min-width: 0; }
@media (max-width: 600px) { .payment-pending { padding: 0 2px; } }

/* El flujo compacto se activa solo en móvil/tableta; escritorio mantiene ambos apartados. */
.checkout__progress, .checkout__back, .checkout__mobile-order { display: none; }
.checkout__selected-description { line-height: 1.35; }
@media (max-width: 900px) {
  .checkout__heading { font-size: clamp(1.3rem, 4.8vw, 1.65rem) !important; margin-bottom: 12px !important; }
  .checkout__progress { display: flex; align-items: center; gap: 8px; width: 100%; padding: 2px 0; }
  .checkout__progress-item {
    display: flex; align-items: center; gap: 6px; flex: 1 1 0; min-width: 0;
    padding: 10px 9px; border: 1px solid var(--nt-border);
    border-radius: 11px; background: var(--nt-surface); color: var(--nt-text-secondary);
    font-weight: 600; font-size: .82rem; cursor: pointer; white-space: nowrap;
  }
  .checkout__progress-item span { display: grid; place-items: center; flex-shrink: 0; width: 23px; height: 23px; border-radius: 50%; background: var(--nt-surface-elevated); }
  .checkout__progress-item--current { color: var(--nt-text); border-color: var(--nt-accent); }
  .checkout__progress-item--current span { background: var(--nt-accent); color: var(--nt-bg); }
  .checkout__progress-item:disabled { opacity: .58; cursor: not-allowed; }
  .checkout__progress > .v-icon { flex-shrink: 0; }
  .checkout__panel--inactive { display: none !important; }
  .checkout__back { display: inline-flex; align-items: center; gap: 4px; color: var(--nt-accent); font-size: .85rem; margin-bottom: 12px; }
  .checkout__mobile-order { display: block; border-top: 1px solid var(--nt-border); margin-top: 14px; padding-top: 12px; }
  .checkout__mobile-order summary { display: flex; align-items: center; gap: 7px; cursor: pointer; list-style: none; }
  .checkout__mobile-order summary::-webkit-details-marker { display: none; }
  .checkout__mobile-order summary strong { margin-left: auto; }
  .checkout__mobile-order .summary__items { font-size: .84rem; }
  .checkout__payment-methods :deep(.v-selection-control) {
    padding: 10px; border-radius: 12px; border: 1px solid var(--nt-border);
    background: var(--nt-bg); margin-bottom: 8px;
  }
  .checkout__payment-methods :deep(.v-selection-control--dirty) { border-color: var(--nt-accent); }
  .summary { display: none; }
  .area__description { display: none; }
  .area { flex-direction: row; align-items: center; flex-wrap: wrap; }
  .area > .font-weight-bold { font-size: .86rem; line-height: 1.25; }
  .checkout__inline-warning { font-size: .85rem; }
}
.checkout__mobile-submit { display: none; }
@media (max-width: 900px) {
  .layout { gap: 12px; padding-bottom: calc(89px + env(safe-area-inset-bottom, 0px)); }
  .step, .summary { padding: 14px; }
  .steps { gap: 12px; }
  .step__title { font-size: 1rem; margin-bottom: 12px; }
  .areas { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .area { min-height: 64px; padding: 10px; gap: 2px; }
  .area :deep(.v-icon) { font-size: 22px !important; }
  .summary :deep(.summary__desktop-submit) { display: none; }
  .checkout__mobile-submit {
    display: flex; position: fixed; z-index: 16; bottom: 0; left: 0; right: 0;
    align-items: center; justify-content: space-between; gap: 10px;
    padding: 10px 16px calc(10px + env(safe-area-inset-bottom, 0px));
    border-top: 1px solid var(--nt-border); background: var(--nt-surface);
    box-shadow: 0 -8px 24px rgb(0 0 0 / 20%);
  }
  .checkout__mobile-total { display: flex; flex-direction: column; }
  .checkout__mobile-total span { font-size: 0.72rem; color: var(--nt-text-muted); }
  .checkout__mobile-total strong { font-size: 1.14rem; }
  .checkout__mobile-submit :deep(.v-btn) { flex: 1 1 auto; max-width: 230px; min-height: 48px; }
}
@media (max-width: 380px) {
  .checkout__progress-item { font-size: .75rem; padding-inline: 6px; }
  .areas { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .area { padding: 7px; }
  .area > .font-weight-bold { font-size: .78rem; }
}

</style>
