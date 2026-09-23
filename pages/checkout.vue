<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { DeliveryArea } from '~/features/catalog/types/catalog'
import type { CheckoutResult, PaymentMethod } from '~/features/orders/types/orders'
import { useShopCatalog } from '~/features/catalog/services/catalogService'
import { useOrdersService } from '~/features/orders/services/ordersService'
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

const cart = useCartStore()
const snackbar = useSnackbar()
const catalog = useShopCatalog()
const orders = useOrdersService()

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

const selectedArea = computed(() => areas.value.find(a => a.idAreaEntrega === areaId.value) ?? null)
const canSubmit = computed(() =>
  !!areaId.value && reference.value.trim().length >= 3 && cart.items.length > 0 && orders.paymentMethods.includes(payment.value)
)

function areaIcon(nombre: string): string {
  return AREA_ICONS[nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()] ?? 'mdi-map-marker-outline'
}

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
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

async function submit(): Promise<void> {
  if (!canSubmit.value || !areaId.value) return
  submitting.value = true
  try {
    result.value = await orders.checkout({ idAreaEntrega: areaId.value, referenciaEntrega: reference.value, metodoPago: payment.value })
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
          to="/mis-pedidos"
        >
          Mis pedidos
        </v-btn>
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
      <h1 class="text-h4 font-weight-bold mb-6">
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
          <!-- 1. Entrega -->
          <section class="step">
            <h2 class="step__title">
              <span class="step__num">1</span> ¿Dónde te lo entregamos?
            </h2>
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
                  class="text-caption text-medium-emphasis"
                >{{ a.descripcion }}</span>
              </button>
            </div>
            <v-textarea
              v-model="reference"
              class="mt-4"
              label="Referencia para encontrarte"
              placeholder="Ej.: mesa junto a la ventana, suéter azul"
              variant="outlined"
              rows="2"
              auto-grow
              :counter="REFERENCE_MAX"
              :maxlength="REFERENCE_MAX"
              :rules="[(v: string) => v.trim().length >= 3 || 'Escribe una referencia (mínimo 3 caracteres).']"
            />
          </section>

          <!-- 2. Pago -->
          <section class="step">
            <h2 class="step__title">
              <span class="step__num">2</span> ¿Cómo vas a pagar?
            </h2>
            <v-radio-group
              v-model="payment"
              hide-details
            >
              <v-radio value="EFECTIVO">
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
                      {{ orders.paymentMethods.includes('TARJETA') ? 'Pago en línea (modo demostración).' : 'Disponible pronto.' }}
                    </div>
                  </div>
                </template>
              </v-radio>
            </v-radio-group>
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
            class="text-none mt-4"
            prepend-icon="mdi-check"
            :disabled="!canSubmit"
            :loading="submitting"
            @click="submit"
          >
            Confirmar pedido
          </v-btn>
          <p
            v-if="!canSubmit"
            class="text-caption text-medium-emphasis mt-2 text-center"
          >
            Elige el área de entrega y escribe una referencia.
          </p>
        </aside>
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
</style>
