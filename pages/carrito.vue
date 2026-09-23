<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { MAX_ITEM_QUANTITY } from '~/features/cart/types/cart'
import type { CartItem } from '~/features/cart/types/cart'
import { getDesignPreview } from '~/features/cart/services/designPreviews'
import { isApiError } from '~/services/api'
import type { ApiError } from '~/types/api'
import { formatQ } from '~/utils/format'

definePageMeta({
  middleware: [
    (to) => {
      if (useRuntimeConfig().public.useMocks) return
      const auth = useAuthStore()
      if (!auth.isBuyer) return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
    }
  ]
})
useHead({ title: 'Carrito · NextTech Custom' })

const cart = useCartStore()
const snackbar = useSnackbar()
const { confirm } = useConfirm()
const error = ref<ApiError | null>(null)
const busy = ref<number | null>(null)
const previews = ref<Record<number, string | null>>({})

function refreshPreviews(): void {
  const map: Record<number, string | null> = {}
  for (const item of cart.items) map[item.idDetalleCarrito] = getDesignPreview(item.idPersonalizacion)
  previews.value = map
}

async function load(): Promise<void> {
  error.value = null
  try {
    await cart.load()
    refreshPreviews()
  }
  catch (e) {
    error.value = isApiError(e) ? e : { status: 0, code: 'UNKNOWN', message: 'No se pudo cargar el carrito.' }
  }
}

async function changeQuantity(item: CartItem, value: number): Promise<void> {
  const cantidad = Math.max(1, Math.min(MAX_ITEM_QUANTITY, Math.round(value || 1)))
  if (cantidad === item.cantidad) return
  busy.value = item.idDetalleCarrito
  try {
    await cart.setQuantity(item.idDetalleCarrito, cantidad)
  }
  catch (e) {
    snackbar.error(isApiError(e) ? e : 'No se pudo cambiar la cantidad.')
  }
  finally {
    busy.value = null
  }
}

async function removeItem(item: CartItem): Promise<void> {
  const ok = await confirm({
    title: '¿Quitar del carrito?',
    message: `${item.nombreProducto} · ${item.nombreVariante}${item.idPersonalizacion ? '. Tu diseño se descarta.' : ''}`,
    confirmText: 'Quitar',
    danger: true
  })
  if (!ok) return
  busy.value = item.idDetalleCarrito
  try {
    await cart.remove(item.idDetalleCarrito)
    refreshPreviews()
    snackbar.info('Producto quitado.')
  }
  catch (e) {
    snackbar.error(isApiError(e) ? e : 'No se pudo quitar el producto.')
  }
  finally {
    busy.value = null
  }
}

onMounted(load)
</script>

<template>
  <v-container
    class="py-8"
    style="max-width: 1100px"
  >
    <h1 class="text-h4 font-weight-bold mb-6">
      Tu carrito
    </h1>

    <StateError
      v-if="error"
      :error="error"
      @retry="load"
    />

    <v-skeleton-loader
      v-else-if="cart.loading && !cart.cart"
      type="list-item-avatar-three-line@2"
    />

    <StateEmpty
      v-else-if="cart.items.length === 0"
      icon="mdi-cart-outline"
      title="Tu carrito está vacío"
      description="Elige un producto del catálogo y diséñalo a tu gusto."
    >
      <template #actions>
        <v-btn
          to="/catalogo"
          color="primary"
          class="text-none"
          prepend-icon="mdi-storefront-outline"
        >
          Ver catálogo
        </v-btn>
      </template>
    </StateEmpty>

    <div
      v-else
      class="layout"
    >
      <ul class="items">
        <li
          v-for="item in cart.items"
          :key="item.idDetalleCarrito"
          class="item"
        >
          <div class="item__thumb">
            <img
              v-if="previews[item.idDetalleCarrito]"
              :src="previews[item.idDetalleCarrito]!"
              alt="Vista previa de tu diseño"
            >
            <v-icon
              v-else
              :icon="item.idPersonalizacion ? 'mdi-palette-outline' : 'mdi-package-variant-closed'"
              size="36"
            />
          </div>

          <div class="item__info">
            <div class="font-weight-bold">
              {{ item.nombreProducto }}
            </div>
            <div class="text-body-2 text-medium-emphasis">
              {{ item.nombreVariante }}
            </div>
            <v-chip
              v-if="item.idPersonalizacion"
              size="x-small"
              color="accent"
              variant="tonal"
              class="mt-1"
              prepend-icon="mdi-check"
            >
              Diseño personalizado
            </v-chip>
            <div class="text-caption text-medium-emphasis mt-1">
              {{ formatQ(item.precioUnitario) }} c/u
            </div>
          </div>

          <v-number-input
            :model-value="item.cantidad"
            :min="1"
            :max="MAX_ITEM_QUANTITY"
            :disabled="busy === item.idDetalleCarrito"
            control-variant="split"
            density="compact"
            hide-details
            class="item__qty"
            aria-label="Cantidad"
            @update:model-value="(v: number) => changeQuantity(item, v)"
          />

          <div class="item__subtotal">
            {{ formatQ(item.subtotal) }}
          </div>

          <v-btn
            icon="mdi-delete-outline"
            variant="text"
            color="error"
            size="small"
            :loading="busy === item.idDetalleCarrito"
            :aria-label="`Quitar ${item.nombreProducto}`"
            @click="removeItem(item)"
          />
        </li>
      </ul>

      <aside class="summary">
        <h2 class="text-subtitle-1 font-weight-bold mb-4">
          Resumen
        </h2>
        <div class="summary__row">
          <span>Productos</span>
          <span>{{ cart.count }}</span>
        </div>
        <div class="summary__row">
          <span>Entrega en el campus</span>
          <span class="text-success">Gratis</span>
        </div>
        <v-divider class="my-3" />
        <div class="summary__row summary__total">
          <span>Total</span>
          <span>{{ formatQ(cart.total) }}</span>
        </div>
        <v-btn
          to="/checkout"
          color="primary"
          size="large"
          block
          class="text-none mt-5"
          append-icon="mdi-arrow-right"
        >
          Continuar con la compra
        </v-btn>
        <v-btn
          to="/catalogo"
          variant="text"
          block
          class="text-none mt-2"
        >
          Seguir comprando
        </v-btn>
      </aside>
    </div>
  </v-container>
</template>

<style scoped>
.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 24px;
  align-items: start;
}

.items {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 12px;
}

.item {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr) 140px 90px auto;
  align-items: center;
  gap: 16px;
  padding: 14px 16px;
  border-radius: 14px;
  border: 1px solid rgb(148 163 184 / 25%);
  background: rgb(30 41 59 / 88%);
}

.item__thumb {
  display: grid;
  place-items: center;
  width: 72px;
  height: 72px;
  border-radius: 12px;
  overflow: hidden;
  background: linear-gradient(145deg, #1d4ed8, #0f172a);
}

.item__thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.item__subtotal {
  text-align: right;
  font-weight: 700;
}

.summary {
  position: sticky;
  top: 80px;
  padding: 20px;
  border-radius: 16px;
  border: 1px solid rgb(148 163 184 / 25%);
  background: rgb(30 41 59 / 92%);
}

.summary__row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  color: var(--nt-text-secondary);
}

.summary__total {
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--nt-text);
}

@media (max-width: 900px) {
  .layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .summary {
    position: static;
  }
}

@media (max-width: 600px) {
  .item {
    grid-template-columns: 64px minmax(0, 1fr) auto;
    grid-template-areas:
      'thumb info del'
      'thumb qty total';
  }

  .item__thumb { grid-area: thumb; width: 64px; height: 64px; }
  .item__info { grid-area: info; }
  .item__qty { grid-area: qty; }
  .item__subtotal { grid-area: total; }
  .item > :last-child { grid-area: del; }
}
</style>
