<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { ProductDetail, ProductVariant } from '~/features/catalog/types/catalog'
import { MAX_ITEM_QUANTITY } from '~/features/cart/types/cart'
import { useShopCatalog } from '~/features/catalog/services/catalogService'
import { isApiError } from '~/services/api'
import type { ApiError } from '~/types/api'
import { formatQ } from '~/utils/format'

const route = useRoute()
const catalog = useShopCatalog()
const cart = useCartStore()
const auth = useAuthStore()
const snackbar = useSnackbar()
const useMocks = !!useRuntimeConfig().public.useMocks

const codigo = computed(() => String(route.params.codigo ?? ''))
const product = ref<ProductDetail | null>(null)
const variantId = ref<number | null>(null)
const quantity = ref(1)
const loading = ref(true)
const adding = ref(false)
const showInfo = ref(false)
const error = ref<ApiError | null>(null)

useHead(() => ({ title: `${product.value?.nombre ?? 'Producto'} · NextTech Custom` }))

const variant = computed<ProductVariant | null>(() =>
  product.value?.variantes.find(v => v.idVariante === variantId.value) ?? null
)
const shape = computed(() => (variant.value?.plantillas[0]?.forma ?? 'RECTANGULAR').toUpperCase())
/** La pieza solo es un atajo si el producto admite diseño y hay variante elegida. */
const enlaceEditor = computed(() => ({
  path: '/personalizar',
  query: { producto: variant.value?.codigoVariante }
}))

const puedeDisenar = computed(() => !!product.value?.permitePersonalizacion && !!variant.value)

/** Mismo destino que el boton "Personalizar" de mas abajo. */
async function irAlEditor(): Promise<void> {
  if (!puedeDisenar.value) return
  await navigateTo(enlaceEditor.value)
}

const sides = computed(() => [...(product.value?.zonas ?? [])].sort((a, b) => a.ordenVisual - b.ordenVisual))

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    product.value = await catalog.getProduct(codigo.value)
    variantId.value = product.value.variantes[0]?.idVariante ?? null
  }
  catch (e) {
    error.value = isApiError(e) ? e : { status: 0, code: 'UNKNOWN', message: 'No se pudo cargar el producto.' }
  }
  finally {
    loading.value = false
  }
}

async function addWithoutDesign(): Promise<void> {
  if (!variant.value) return
  if (!useMocks && !auth.isBuyer) {
    await navigateTo({ path: '/login', query: { redirect: route.fullPath } })
    return
  }
  adding.value = true
  try {
    await cart.add({ idVariante: variant.value.idVariante, cantidad: quantity.value })
    snackbar.success('Agregado al carrito.')
  }
  catch (e) {
    snackbar.error(isApiError(e) ? e : 'No se pudo agregar al carrito.')
  }
  finally {
    adding.value = false
  }
}

onMounted(load)
</script>

<template>
  <v-container
    class="py-8"
    style="max-width: 1100px"
  >
    <v-btn
      to="/catalogo"
      variant="text"
      prepend-icon="mdi-arrow-left"
      class="text-none mb-4 px-2"
    >
      Catálogo
    </v-btn>

    <v-skeleton-loader
      v-if="loading"
      type="image, article, actions"
    />

    <StateError
      v-else-if="error"
      :error="error"
      @retry="load"
    />

    <div
      v-else-if="product"
      class="detail"
    >
      <!-- Vista del producto -->
      <div class="stage">
        <!-- La pieza es el atajo al editor: tocarla es lo primero que intenta el comprador. -->
        <!-- La pieza es el atajo al editor: tocarla es lo primero que intenta el comprador. -->
        <div
          class="stage__piece"
          :class="[
            `stage__piece--${shape.startsWith('CIRC') ? 'circle' : shape.startsWith('CUAD') ? 'square' : 'rect'}`,
            { 'stage__piece--clickable': puedeDisenar }
          ]"
          :role="puedeDisenar ? 'button' : undefined"
          :tabindex="puedeDisenar ? 0 : undefined"
          @click="irAlEditor"
          @keydown.enter.prevent="irAlEditor"
          @keydown.space.prevent="irAlEditor"
        >
          <span class="stage__hole" />
          <v-icon
            :icon="puedeDisenar ? 'mdi-palette-outline' : 'mdi-image-outline'"
            size="48"
          />
          <span class="text-caption stage__cta">
            {{ puedeDisenar ? 'Toca para diseñar tu llavero' : 'Tu diseño aquí' }}
          </span>
        </div>
        <div class="stage__sides">
          <v-chip
            v-for="z in sides"
            :key="z.idZona"
            size="small"
            variant="tonal"
            :prepend-icon="z.esObligatoria ? 'mdi-check-circle-outline' : 'mdi-circle-outline'"
          >
            {{ z.nombre }}
          </v-chip>
        </div>
      </div>

      <!-- Información y compra -->
      <div class="info">
        <div class="text-overline text-accent">
          {{ product.categoria }}
        </div>
        <h1 class="text-h4 font-weight-bold">
          {{ product.nombre }}
        </h1>
        <div class="text-h5 font-weight-bold mt-2">
          {{ formatQ(variant?.precioActual ?? product.precioBase) }}
        </div>
        <v-btn
          variant="outlined"
          color="accent"
          size="small"
          class="info__trigger text-none mt-3"
          prepend-icon="mdi-information-outline"
          @click="showInfo = true"
        >
          Información y características
        </v-btn>

        <section
          v-if="product.variantes.length > 1"
          class="mt-6"
        >
          <h2 class="info__label">
            Modelo
          </h2>
          <v-chip-group
            v-model="variantId"
            mandatory
            selected-class="text-accent"
          >
            <v-chip
              v-for="v in product.variantes"
              :key="v.idVariante"
              :value="v.idVariante"
              variant="outlined"
              filter
            >
              {{ v.nombre }} · {{ formatQ(v.precioActual) }}
            </v-chip>
          </v-chip-group>
        </section>



        <div class="actions mt-8">
          <template v-if="product.permitePersonalizacion">
            <v-btn
              color="primary"
              size="x-large"
              class="text-none"
              prepend-icon="mdi-palette-outline"
              :to="{ path: '/personalizar', query: { producto: variant?.codigoVariante } }"
              :disabled="!variant"
            >
              Personalizar
            </v-btn>
            <p class="text-caption text-medium-emphasis mt-2">
              Diseñas los dos lados y lo agregas al carrito desde el editor.
            </p>
          </template>
          <template v-else>
            <div class="d-flex align-center ga-3">
              <v-number-input
                v-model="quantity"
                :min="1"
                :max="MAX_ITEM_QUANTITY"
                control-variant="split"
                density="compact"
                hide-details
                style="max-width: 150px"
                aria-label="Cantidad"
              />
              <v-btn
                color="primary"
                size="large"
                class="text-none"
                prepend-icon="mdi-cart-plus"
                :loading="adding"
                @click="addWithoutDesign"
              >
                Agregar al carrito
              </v-btn>
            </div>
          </template>
        </div>


      </div>
    </div>

    <!-- Información secundaria: misma información, accesible sin ocupar la pantalla principal. -->
    <v-dialog v-model="showInfo" max-width="500" scrollable>
      <v-card rounded="lg">
        <v-card-title class="d-flex align-center ga-2">
          <v-icon icon="mdi-information-outline" color="accent" />
          Información del producto
          <v-spacer />
          <v-btn icon="mdi-close" variant="text" aria-label="Cerrar información" @click="showInfo = false" />
        </v-card-title>
        <v-card-text v-if="product" class="detail__info-body">
          <p v-if="product.descripcion" class="text-body-1 mb-4">{{ product.descripcion }}</p>
          <template v-if="variant?.atributos.length || product.medidas">
            <h2 class="info__label mb-3">Características</h2>
            <dl class="attrs mb-5">
              <template v-for="a in variant?.atributos ?? []" :key="a.atributo">
                <dt>{{ a.atributo }}</dt>
                <dd>{{ a.valor }}</dd>
              </template>
              <template v-if="product.medidas">
                <dt>Diámetro</dt>
                <dd>{{ product.medidas.diametroLlaveroPulgadas }}" ({{ product.medidas.diametroLlaveroMm }} mm)</dd>
              </template>
            </dl>
          </template>
          <h2 class="info__label mb-3">Compra y entrega</h2>
          <ul class="perks">
            <li><v-icon icon="mdi-map-marker-radius-outline" /> Entrega dentro del campus</li>
            <li><v-icon icon="mdi-cash" /> Pago en efectivo al recibir</li>
            <li><v-icon icon="mdi-timer-sand" /> Elaboración en minutos y seguimiento en tiempo real</li>
          </ul>
        </v-card-text>
        <v-card-actions><v-spacer /><v-btn variant="tonal" @click="showInfo = false">Cerrar</v-btn></v-card-actions>
      </v-card>
    </v-dialog>

    <!-- CTA móvil: mismas rutas, mismo handler y condiciones que la acción original. -->
    <div v-if="product && variant" class="detail__mobile-action" aria-label="Continuar con el producto">
      <span class="detail__mobile-price">{{ formatQ(variant.precioActual) }}</span>
      <v-btn
        v-if="product.permitePersonalizacion"
        color="primary"
        class="text-none"
        :to="{ path: '/personalizar', query: { producto: variant.codigoVariante } }"
        prepend-icon="mdi-palette-outline"
      >
        Personalizar
      </v-btn>
      <v-btn v-else color="primary" class="text-none" :loading="adding" prepend-icon="mdi-cart-plus" @click="addWithoutDesign">
        Agregar
      </v-btn>
    </div>
  </v-container>
</template>

<style scoped>
.detail {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
  gap: 48px;
  align-items: start;
}

.stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 40px 24px;
  border-radius: 20px;
  border: 1px solid rgb(148 163 184 / 25%);
  background:
    radial-gradient(circle at 50% 30%, rgb(37 99 235 / 30%), transparent 65%),
    rgb(30 41 59 / 85%);
}

.stage__piece {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: min(240px, 60vw);
  color: rgb(248 250 252 / 85%);
  background: linear-gradient(160deg, #3b82f6, #1e40af);
  box-shadow: 0 30px 60px -30px rgb(0 0 0 / 80%), 0 0 50px -14px rgb(37 99 235 / 70%);
}

.stage__piece--clickable {
  cursor: pointer;
  text-decoration: none;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

/* El agujero y los iconos no deben robarse el toque. */
.stage__piece--clickable > * {
  pointer-events: none;
}

.stage__piece--clickable:focus-visible {
  outline: 3px solid rgb(6 182 212 / 80%);
  outline-offset: 4px;
}

.stage__piece--clickable:hover,
.stage__piece--clickable:focus-visible {
  transform: translateY(-4px);
  box-shadow: 0 36px 70px -28px rgb(0 0 0 / 85%), 0 0 60px -10px rgb(37 99 235 / 85%);
}

.stage__cta {
  padding-inline: 16px;
  text-align: center;
  font-weight: 600;
}

.stage__piece--circle {
  aspect-ratio: 1;
  border-radius: 50%;
}

.stage__piece--square {
  aspect-ratio: 1;
  border-radius: 24px;
}

.stage__piece--rect {
  aspect-ratio: 3 / 4;
  border-radius: 18px;
}

.stage__hole {
  position: absolute;
  top: 14px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--nt-bg);
}

.stage__sides {
  display: flex;
  gap: 8px;
}

.info__label {
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--nt-text-muted);
  margin-bottom: 6px;
}

.attrs {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 6px 20px;
  margin: 0;
}

.attrs dt {
  color: var(--nt-text-muted);
}

.attrs dd {
  margin: 0;
  font-weight: 600;
}

.perks {
  list-style: none;
  padding: 0;
  display: grid;
  gap: 10px;
  color: var(--nt-text-secondary);
}

.perks li {
  display: flex;
  align-items: center;
  gap: 10px;
}

@media (max-width: 860px) {
  .detail {
    grid-template-columns: minmax(0, 1fr);
    gap: 28px;
  }
}

.detail__mobile-action { display: none; }
.detail__info-body { overflow-wrap: anywhere; }
@media (max-width: 860px) {
  .detail { gap: 10px; }
  .info { order: -1; }
  .info__trigger { max-width: 100%; }
  .info .text-h5 { margin-top: 2px !important; }
  .stage { padding: 14px 12px; gap: 8px; }
  .stage__piece { width: min(174px, 44vw); }
  .stage__sides { flex-wrap: wrap; justify-content: center; }
  .info .text-h4 { font-size: clamp(1.35rem, 5.5vw, 1.9rem) !important; }
  .info .text-h5 { font-size: 1.35rem !important; }
  .info .mt-8 { margin-top: 16px !important; }
  .info .mt-6 { margin-top: 12px !important; }
  .info .mt-4 { margin-top: 12px !important; }
}
@media (max-width: 600px) {
  .detail { padding-bottom: calc(82px + env(safe-area-inset-bottom, 0px)); }
  .detail__mobile-action {
    display: flex; position: fixed; bottom: 0; left: 0; right: 0; z-index: 15;
    align-items: center; justify-content: space-between; gap: 12px;
    padding: 10px 16px calc(10px + env(safe-area-inset-bottom, 0px));
    background: var(--nt-surface); border-top: 1px solid var(--nt-border);
    box-shadow: 0 -8px 24px rgb(0 0 0 / 20%);
  }
  .detail__mobile-action :deep(.v-btn) { min-height: 46px; flex: 1; max-width: 220px; }
  .detail__mobile-price { font-weight: 800; font-size: 1.08rem; white-space: nowrap; }
  .actions > :deep(.v-btn), .actions > .d-flex > :deep(.v-btn) { display: none; }
  .perks { margin-top: 16px !important; }
}

</style>
