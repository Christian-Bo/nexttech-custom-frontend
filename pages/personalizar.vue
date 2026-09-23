<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref } from 'vue'
import { DEFAULT_TEMPLATE_CODE, PRODUCT_TEMPLATES } from '~/features/personalization/config/products'
import type { DesignExport, ProductTemplate } from '~/features/personalization/types/editor'
import { useCatalogService } from '~/features/personalization/services/catalogService'
import { usePersonalizationService } from '~/features/personalization/services/personalizationService'
import { isApiError } from '~/services/api'
import { useAuthStore } from '~/stores/auth'
import type { ApiError } from '~/types/api'
import { formatQ } from '~/utils/format'
import { MOCK_PRODUCTS, findMockVariant } from '~/features/catalog/services/mockCatalog'
import { saveDesignPreview } from '~/features/cart/services/designPreviews'

// Fabric solo existe en el navegador: el editor se carga en cliente.
const ProductCustomizer = defineAsyncComponent(
  () => import('~/features/personalization/components/ProductCustomizer.vue')
)

useHead({ title: 'Personalizar · NextTech Custom' })

const config = useRuntimeConfig()
const route = useRoute()
const router = useRouter()
const snackbar = useSnackbar()
const auth = useAuthStore()
const cart = useCartStore()
const useMocks = config.public.useMocks

const templates = ref<ProductTemplate[]>(useMocks ? PRODUCT_TEMPLATES : [])
const loading = ref(!useMocks)
const error = ref<ApiError | null>(null)
const saving = ref(false)
const saved = ref<{ name: string, price?: number } | null>(null)

const code = computed({
  get: () => {
    const q = route.query.producto as string | undefined
    return templates.value.find(t => t.code === q)?.code
      ?? templates.value.find(t => t.code === DEFAULT_TEMPLATE_CODE)?.code
      ?? templates.value[0]?.code
      ?? ''
  },
  set: (value: string) => router.replace({ query: { ...route.query, producto: value } })
})
const template = computed(() => templates.value.find(t => t.code === code.value) ?? null)

async function loadCatalog(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    templates.value = await useCatalogService().listTemplates()
  }
  catch (e) {
    error.value = isApiError(e) ? e : { status: 0, code: 'UNKNOWN', message: 'No se pudo cargar el catálogo.' }
  }
  finally {
    loading.value = false
  }
}

const personalizationService = useMocks ? null : usePersonalizationService()

async function onComplete(output: DesignExport): Promise<void> {
  if (!template.value) return
  // Modo demo: el diseño se agrega al carrito de demostración.
  if (!personalizationService) {
    const idVariante = MOCK_PRODUCTS.flatMap(p => p.variantes).find(v => v.codigoVariante === template.value!.code)?.idVariante
    if (!idVariante) {
      snackbar.warning('Este producto no está en el catálogo de demostración.')
      return
    }
    saving.value = true
    try {
      const idPersonalizacion = Date.now()
      await saveDesignPreview(idPersonalizacion, output.images.A)
      await cart.add({ idVariante, cantidad: 1, idPersonalizacion })
      saved.value = { name: template.value.name, price: template.value.price ?? findMockVariant(idVariante)?.variant.precioActual }
    }
    finally {
      saving.value = false
    }
    return
  }
  // Hay que ser comprador: el diseño queda autoguardado y se recupera al volver.
  if (!auth.isBuyer) {
    snackbar.info('Inicia sesión para agregar tu diseño al carrito. Tu diseño queda guardado.')
    await navigateTo({ path: '/login', query: { redirect: route.fullPath } })
    return
  }
  saving.value = true
  try {
    const id = await personalizationService.save(template.value, output)
    await personalizationService.addToCart(template.value.idVariante!, id)
    await saveDesignPreview(id, output.images.A)
    await cart.load()
    saved.value = { name: template.value.name, price: template.value.price }
  }
  catch (e) {
    snackbar.error(isApiError(e) ? e : 'No se pudo guardar tu diseño.')
  }
  finally {
    saving.value = false
  }
}


onMounted(() => {
  if (!useMocks) void loadCatalog()
})
</script>

<template>
  <v-container
    fluid
    class="py-6 px-4 px-md-8"
    style="max-width: 1440px"
  >
    <div class="d-flex flex-wrap align-center ga-4 mb-6">
      <h1 class="text-h5 font-weight-bold">
        Personaliza tu producto
      </h1>
      <v-chip
        v-if="template?.price !== undefined"
        color="primary"
        variant="tonal"
      >
        {{ formatQ(template.price) }}
      </v-chip>
      <v-spacer />
      <v-select
        v-if="templates.length > 0"
        v-model="code"
        :items="templates"
        item-title="name"
        item-value="code"
        label="Producto"
        density="compact"
        hide-details
        style="max-width: 340px"
      />
    </div>

    <v-skeleton-loader
      v-if="loading"
      type="image, actions"
      height="520"
    />

    <StateError
      v-else-if="error"
      :error="error"
      @retry="loadCatalog"
    />

    <StateEmpty
      v-else-if="!template"
      icon="mdi-palette-outline"
      title="No hay productos personalizables"
      description="Vuelve más tarde."
    />

    <ClientOnly v-else>
      <ProductCustomizer
        :key="template.code"
        :template="template"
        :saving="saving"
        :finish-text="'Agregar al carrito'"
        @complete="onComplete"
      />
      <template #fallback>
        <v-skeleton-loader
          type="image, actions"
          height="520"
        />
      </template>
    </ClientOnly>

    <!-- Confirmación -->
    <v-dialog
      :model-value="!!saved"
      max-width="420"
      @update:model-value="(v: boolean) => { if (!v) saved = null }"
    >
      <v-card
        v-if="saved"
        class="pa-6 text-center"
        rounded="lg"
      >
        <v-icon
          icon="mdi-cart-check"
          size="56"
          color="success"
        />
        <h2 class="text-h6 font-weight-bold mt-2">
          ¡Agregado al carrito!
        </h2>
        <p class="text-body-2 text-medium-emphasis">
          {{ saved.name }}<span v-if="saved.price !== undefined"> · {{ formatQ(saved.price) }}</span>
        </p>
        <div class="d-flex flex-column ga-2 mt-4">
          <v-btn
                        color="primary"
            to="/carrito"
          >
            Ir al carrito
          </v-btn>
          <v-btn
            variant="tonal"
            @click="saved = null"
          >
            Diseñar otro
          </v-btn>
        </div>
      </v-card>
    </v-dialog>

  </v-container>
</template>
