<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { ProductDetail, ProductSummary, ProductVariant } from '~/features/catalog/types/catalog'
import { categoryIcon, useShopCatalog } from '~/features/catalog/services/catalogService'
import { isApiError } from '~/services/api'
import type { ApiError } from '~/types/api'
import { formatQ } from '~/utils/format'

useHead({ title: 'Catálogo · NextTech Custom' })

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const catalog = useShopCatalog()
/** Bienvenida al terminar el registro (/catalogo?bienvenida=1). */
const welcome = ref(route.query.bienvenida === '1')

function closeWelcome(): void {
  welcome.value = false
  void router.replace({ query: {} })
}
const products = ref<ProductSummary[]>([])
const loading = ref(true)
const error = ref<ApiError | null>(null)
const search = ref('')
const category = ref<string>('Todos')

// El listado solo contiene datos resumidos. Consultamos el detalle bajo demanda
// para conservar la selección correcta de variante y mostrar todos sus atributos.
const detailCache = new Map<string, ProductDetail>()
const detailRequests = new Map<string, Promise<ProductDetail>>()
const infoDialog = ref(false)
const infoLoading = ref(false)
const infoError = ref<ApiError | null>(null)
const infoCode = ref('')
const infoProduct = ref<ProductDetail | null>(null)
const infoVariantId = ref<number | null>(null)
const openingCode = ref<string | null>(null)
const snackbar = useSnackbar()

const infoVariant = computed<ProductVariant | null>(() =>
  infoProduct.value?.variantes.find(v => v.idVariante === infoVariantId.value) ?? null
)

async function getDetail(codigo: string): Promise<ProductDetail> {
  const cached = detailCache.get(codigo)
  if (cached) return cached
  const pending = detailRequests.get(codigo)
  if (pending) return pending
  const request = catalog.getProduct(codigo)
  detailRequests.set(codigo, request)
  try {
    const result = await request
    detailCache.set(codigo, result)
    return result
  }
  finally {
    detailRequests.delete(codigo)
  }
}

async function showProductInfo(codigo: string): Promise<void> {
  infoCode.value = codigo
  infoProduct.value = null
  infoVariantId.value = null
  infoError.value = null
  infoLoading.value = true
  infoDialog.value = true
  try {
    const detail = await getDetail(codigo)
    if (infoCode.value !== codigo || !infoDialog.value) return
    infoProduct.value = detail
    infoVariantId.value = detail.variantes.find(v => v.plantillas?.length)?.idVariante
      ?? detail.variantes[0]?.idVariante
      ?? null
  }
  catch (e) {
    if (infoCode.value === codigo && infoDialog.value) {
      infoError.value = isApiError(e) ? e : { status: 0, code: 'UNKNOWN', message: 'No se pudo consultar la información.' }
    }
  }
  finally {
    if (infoCode.value === codigo) infoLoading.value = false
  }
}

async function startCustomization(codigo: string, preferredVariant?: ProductVariant | null): Promise<void> {
  if (openingCode.value) return
  openingCode.value = codigo
  try {
    const detail = await getDetail(codigo)
    if (!detail.permitePersonalizacion) {
      await navigateTo(`/catalogo/${encodeURIComponent(codigo)}`)
      return
    }
    const selected = preferredVariant?.codigoVariante
      ? detail.variantes.find(v => v.idVariante === preferredVariant.idVariante && v.plantillas?.length > 0)
      : null
    const variant = selected
      ?? detail.variantes.find(v => v.plantillas?.length && v.codigoVariante)
    if (!variant?.codigoVariante) {
      snackbar.warning('Este producto todavía no tiene un modelo disponible para personalizar.')
      return
    }
    await navigateTo({ path: '/personalizar', query: { producto: variant.codigoVariante } })
  }
  catch (e) {
    snackbar.error(isApiError(e) ? e : 'No se pudo abrir el personalizador. Intenta nuevamente.')
  }
  finally {
    openingCode.value = null
  }
}

const categories = computed(() => ['Todos', ...new Set(products.value.map(p => p.categoria))])

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return products.value.filter(p =>
    (category.value === 'Todos' || p.categoria === category.value)
    && (!q || `${p.nombre} ${p.descripcion ?? ''} ${p.categoria}`.toLowerCase().includes(q))
  )
})

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    products.value = await catalog.listProducts()
  }
  catch (e) {
    error.value = isApiError(e) ? e : { status: 0, code: 'UNKNOWN', message: 'No se pudo cargar el catálogo.' }
  }
  finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <v-container
    class="py-8"
    style="max-width: 1200px"
  >
    <v-expand-transition>
      <section
        v-if="welcome"
        class="welcome mb-8"
        role="status"
      >
        <span
          class="welcome__confetti"
          aria-hidden="true"
        >🎉</span>
        <div class="welcome__body">
          <h2 class="text-h5 font-weight-bold">
            ¡Bienvenido a NextTech Custom{{ auth.nickname ? `, ${auth.nickname}` : '' }}!
          </h2>
          <p class="text-medium-emphasis mt-1">
            Tu cuenta está lista. Recibirás tu mensaje de bienvenida por los canales que elegiste.
            La credencial PDF oficial se obtiene después de registrar tu rostro. ¡Descubre nuestros productos!
          </p>
          <div class="d-flex flex-wrap ga-2 mt-4">
            <v-btn
              color="primary"
              class="text-none"
              prepend-icon="mdi-palette-outline"
              to="/personalizar"
            >
              Diseñar mi primer llavero
            </v-btn>
            <v-btn
              variant="tonal"
              class="text-none"
              prepend-icon="mdi-card-account-details-outline"
              to="/mi-credencial"
            >
              Mi credencial
            </v-btn>
          </div>
        </div>
        <v-btn
          icon="mdi-close"
          variant="text"
          size="small"
          class="welcome__close"
          aria-label="Cerrar bienvenida"
          @click="closeWelcome"
        />
      </section>
    </v-expand-transition>

    <header class="mb-6">
      <h1 class="text-h4 font-weight-bold">
        Catálogo
      </h1>
      <p class="text-medium-emphasis mt-1">
        Elige un producto y diséñalo por los dos lados. Lo recibes dentro del campus.
      </p>
    </header>

    <div class="filters mb-6">
      <v-text-field
        v-model="search"
        prepend-inner-icon="mdi-magnify"
        placeholder="Buscar producto"
        density="comfortable"
        variant="outlined"
        hide-details
        clearable
        class="filters__search"
      />
      <v-chip-group
        v-model="category"
        mandatory
        selected-class="text-accent"
      >
        <v-chip
          v-for="c in categories"
          :key="c"
          :value="c"
          variant="outlined"
          filter
        >
          {{ c }}
        </v-chip>
      </v-chip-group>
    </div>

    <div
      v-if="loading"
      class="grid"
    >
      <v-skeleton-loader
        v-for="i in 4"
        :key="i"
        type="image, article"
        rounded="lg"
      />
    </div>

    <StateError
      v-else-if="error"
      :error="error"
      @retry="load"
    />

    <StateEmpty
      v-else-if="filtered.length === 0"
      icon="mdi-magnify-close"
      title="No encontramos productos"
      description="Prueba con otra búsqueda o categoría."
    />

    <div
      v-else
      class="grid"
    >
      <v-card
        v-for="p in filtered"
        :key="p.codigoProducto"
        border
        variant="flat"
        rounded="lg"
        class="product"
      >
        <div class="product__media">
          <v-icon
            :icon="categoryIcon(p.categoria)"
            size="64"
          />
          <v-chip
            v-if="p.permitePersonalizacion"
            size="x-small"
            color="accent"
            variant="flat"
            class="product__badge"
            prepend-icon="mdi-palette-outline"
          >
            Personalizable
          </v-chip>
        </div>
        <v-card-item>
          <div class="text-caption text-medium-emphasis">
            {{ p.categoria }}
          </div>
          <v-card-title class="px-0 text-wrap">
            {{ p.nombre }}
          </v-card-title>
          <v-btn
            variant="text"
            color="accent"
            size="small"
            density="compact"
            prepend-icon="mdi-information-outline"
            class="product__info-link text-none"
            :aria-label="`Información y características de ${p.nombre}`"
            @click="showProductInfo(p.codigoProducto)"
          >
            Información y características
          </v-btn>
        </v-card-item>
        <v-card-text class="product__desc">
          {{ p.descripcion }}
        </v-card-text>
        <v-card-actions class="px-4 pb-4">
          <div>
            <div class="text-caption text-medium-emphasis">
              Desde
            </div>
            <div class="text-h6 font-weight-bold">
              {{ formatQ(p.precioDesde) }}
            </div>
          </div>
          <v-spacer />
          <v-btn
            v-if="p.permitePersonalizacion"
            color="primary"
            variant="flat"
            class="product__cta text-none"
            append-icon="mdi-arrow-right"
            :loading="openingCode === p.codigoProducto"
            :disabled="openingCode !== null && openingCode !== p.codigoProducto"
            @click="startCustomization(p.codigoProducto)"
          >
            Personalizar
          </v-btn>
          <v-btn
            v-else
            color="primary"
            variant="flat"
            class="product__cta text-none"
            append-icon="mdi-arrow-right"
            :to="`/catalogo/${encodeURIComponent(p.codigoProducto)}`"
          >
            Ver opciones
          </v-btn>
        </v-card-actions>
      </v-card>
    </div>

    <!-- Las características se consultan solo al solicitarlas: no se descargan
         todos los detalles e imágenes en el primer render del catálogo. -->
    <v-dialog v-model="infoDialog" max-width="520" scrollable>
      <v-card rounded="lg">
        <v-card-title class="d-flex align-center ga-2 product-info__title">
          <v-icon icon="mdi-information-outline" color="accent" />
          <span class="text-truncate">Información y características</span>
          <v-spacer />
          <v-btn
            icon="mdi-close"
            variant="text"
            size="small"
            aria-label="Cerrar información"
            @click="infoDialog = false"
          />
        </v-card-title>
        <v-card-text>
          <v-skeleton-loader v-if="infoLoading" type="article, list-item-two-line" />
          <StateError
            v-else-if="infoError"
            :error="infoError"
            @retry="showProductInfo(infoCode)"
          />
          <template v-else-if="infoProduct">
            <h2 class="text-h6 font-weight-bold mb-1">{{ infoProduct.nombre }}</h2>
            <p v-if="infoProduct.descripcion" class="text-body-2 text-medium-emphasis mb-4">
              {{ infoProduct.descripcion }}
            </p>

            <template v-if="infoProduct.variantes.length > 1">
              <h3 class="text-subtitle-2 font-weight-bold mb-2">Modelo</h3>
              <v-select
                v-model="infoVariantId"
                :items="infoProduct.variantes.filter(v => !infoProduct?.permitePersonalizacion || v.plantillas?.length > 0)"
                item-title="nombre"
                item-value="idVariante"
                density="compact"
                variant="outlined"
                hide-details
                class="mb-4"
                aria-label="Seleccionar modelo"
              />
            </template>
            <p v-if="infoVariant" class="text-h6 font-weight-bold mb-3">{{ formatQ(infoVariant.precioActual) }}</p>

            <template v-if="infoVariant?.atributos.length || infoProduct.medidas">
              <h3 class="text-subtitle-2 font-weight-bold mb-2">Características</h3>
              <dl class="product-info__attrs mb-4">
                <template v-for="attr in infoVariant?.atributos ?? []" :key="attr.atributo">
                  <dt>{{ attr.atributo }}</dt>
                  <dd>{{ attr.valor }}</dd>
                </template>
                <template v-if="infoProduct.medidas">
                  <dt>Diámetro del llavero</dt>
                  <dd>{{ infoProduct.medidas.diametroLlaveroPulgadas }}&quot; ({{ infoProduct.medidas.diametroLlaveroMm }} mm)</dd>
                </template>
              </dl>
            </template>
            <h3 class="text-subtitle-2 font-weight-bold mb-2">Compra y entrega</h3>
            <p class="text-body-2 mb-1"><v-icon icon="mdi-map-marker-radius-outline" size="small" /> Entrega dentro del campus</p>
            <p class="text-body-2 mb-1"><v-icon icon="mdi-cash" size="small" /> Pago en efectivo al recibir</p>
            <p class="text-body-2"><v-icon icon="mdi-timer-sand" size="small" /> Elaboración en minutos y seguimiento en tiempo real</p>
          </template>
        </v-card-text>
        <v-card-actions class="px-4 pb-4 flex-wrap ga-2">
          <v-btn
            v-if="infoProduct"
            variant="text"
            class="text-none"
            :to="`/catalogo/${encodeURIComponent(infoProduct.codigoProducto)}`"
          >
            Ficha completa
          </v-btn>
          <v-spacer />
          <v-btn
            v-if="infoProduct?.permitePersonalizacion"
            color="primary"
            variant="flat"
            class="text-none"
            prepend-icon="mdi-palette-outline"
            :disabled="!infoVariant"
            :loading="openingCode === infoProduct.codigoProducto"
            @click="startCustomization(infoProduct.codigoProducto, infoVariant)"
          >
            Personalizar
          </v-btn>
          <v-btn
            v-else
            variant="tonal"
            class="text-none"
            @click="infoDialog = false"
          >
            Cerrar
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<style scoped>
.welcome {
  position: relative;
  display: flex;
  gap: 20px;
  align-items: flex-start;
  padding: 24px;
  border-radius: 20px;
  border: 1px solid rgb(6 182 212 / 45%);
  background:
    radial-gradient(circle at 0% 0%, rgb(6 182 212 / 25%), transparent 55%),
    radial-gradient(circle at 100% 100%, rgb(37 99 235 / 30%), transparent 55%),
    rgb(30 41 59 / 92%);
  box-shadow: 0 0 40px -16px rgb(6 182 212 / 60%);
}

.welcome__confetti {
  font-size: 2.6rem;
  line-height: 1;
  animation: pop 0.6s cubic-bezier(0.2, 1.4, 0.4, 1);
}

.welcome__body {
  flex: 1;
}

.welcome__close {
  position: absolute;
  top: 8px;
  right: 8px;
}

@keyframes pop {
  from { transform: scale(0.3) rotate(-30deg); opacity: 0; }
  to { transform: scale(1) rotate(0); opacity: 1; }
}

.filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 20px;
}

.filters__search {
  flex: 1 1 260px;
  max-width: 360px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 20px;
}

.product {
  display: flex;
  flex-direction: column;
  background: rgb(30 41 59 / 88%);
  backdrop-filter: blur(4px);
}

.product__media {
  position: relative;
  display: grid;
  place-items: center;
  height: 150px;
  color: #fff;
  background:
    radial-gradient(circle at 30% 20%, rgb(6 182 212 / 45%), transparent 60%),
    linear-gradient(145deg, #1d4ed8, #0f172a);
}

.product__badge {
  position: absolute;
  top: 12px;
  right: 12px;
}

.product__desc {
  flex: 1;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  color: var(--nt-text-secondary);
}

/* Acciones compactas sin esconder el destino principal del producto. */
.product__info-link { padding-inline: 0 !important; }
.product__info-link :deep(.v-btn__content) { white-space: normal; }
.product-info__title { min-width: 0; }
.product-info__attrs { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 8px 14px; }
.product-info__attrs dt { color: var(--nt-text-secondary); }
.product-info__attrs dd { margin: 0; font-weight: 600; overflow-wrap: anywhere; }

/* Catálogo con menos altura por ficha y filtros accesibles con una mano. */
@media (max-width: 600px) {
  .v-container { padding-top: 12px !important; }
  header { margin-bottom: 12px !important; }
  header h1 { font-size: 1.65rem !important; }
  header p { font-size: 0.88rem; line-height: 1.35; }
  .filters { align-items: stretch; gap: 8px; margin-bottom: 16px !important; }
  .filters__search { flex-basis: 100%; max-width: none; }
  .filters :deep(.v-chip-group) { max-width: 100%; overflow-x: auto; }
  .grid { grid-template-columns: minmax(0, 1fr); gap: 10px; }
  .product { display: grid; grid-template-columns: minmax(88px, 27%) minmax(0, 1fr); grid-template-rows: auto auto; }
  .product__media { grid-row: 1 / 3; height: auto !important; min-height: 126px; }
  .product__badge { display: none; }
  .product :deep(.v-card-item) { min-width: 0; }
  .product :deep(.v-card-actions) { grid-column: 2; align-self: end; }
  .product :deep(.v-card-actions .v-btn) { min-height: 40px; }
  .product__media { height: 100px; }
  .product__media > .v-icon { font-size: 38px !important; }
  .product__badge { top: 5px; right: 5px; }
  .product :deep(.v-card-item) { padding: 10px 10px 2px; }
  .product :deep(.v-card-title) { font-size: 0.94rem; line-height: 1.25; }
  .product__desc { display: none; }
  .product :deep(.v-card-actions) { padding: 8px 10px 12px !important; gap: 4px; }
  .product :deep(.v-card-actions .v-btn) { min-width: 0; padding-inline: 9px; font-size: 0.78rem; }
  .product__info-link { font-size: 0.7rem !important; max-width: 100%; min-width: 0; margin-top: 4px; justify-content: flex-start; }
  .product__info-link :deep(.v-btn__content) { white-space: normal; text-align: left; line-height: 1.15; }
  .welcome { padding: 16px; gap: 8px; margin-bottom: 16px !important; }
  .welcome__confetti { display: none; }
}
@media (max-width: 360px) { .grid { grid-template-columns: minmax(0, 1fr); } }

</style>
