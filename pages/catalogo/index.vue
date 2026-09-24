<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { ProductSummary } from '~/features/catalog/types/catalog'
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
            Tu cuenta está lista. Te enviamos un correo de bienvenida con tu credencial.
            Elige tu primer producto, diséñalo por los dos lados y recíbelo en el campus.
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
              to="/mi-foto"
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
        :to="`/catalogo/${encodeURIComponent(p.codigoProducto)}`"
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
            color="primary"
            variant="flat"
            class="text-none"
            append-icon="mdi-arrow-right"
          >
            Ver
          </v-btn>
        </v-card-actions>
      </v-card>
    </div>
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
</style>
