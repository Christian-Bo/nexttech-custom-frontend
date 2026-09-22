<script setup lang="ts">
import { computed, defineAsyncComponent, ref } from 'vue'
import { DEFAULT_TEMPLATE_CODE, PRODUCT_TEMPLATES, findTemplate } from '~/features/personalization/config/products'
import type { DesignExport } from '~/features/personalization/types/editor'

// Fabric solo existe en el navegador: el editor se carga en cliente.
const ProductCustomizer = defineAsyncComponent(
  () => import('~/features/personalization/components/ProductCustomizer.vue')
)

useHead({ title: 'Personalizar · NextTech Custom' })

const route = useRoute()
const router = useRouter()
const snackbar = useSnackbar()

const code = computed({
  get: () => findTemplate(route.query.producto as string)?.code ?? DEFAULT_TEMPLATE_CODE,
  set: (value: string) => router.replace({ query: { ...route.query, producto: value } })
})
const template = computed(() => findTemplate(code.value)!)

const result = ref<{ json: string, sizes: string[] } | null>(null)

function onComplete(output: DesignExport): void {
  // TODO(Integrante 3): POST personalización -> ConfiguracionJson + IdArchivoImagenFinal por zona.
  const json = JSON.stringify(output.design)
  result.value = {
    json,
    sizes: Object.entries(output.images).map(([k, b]) => `Lado ${k}: ${(b.size / 1024).toFixed(0)} KB`)
  }
  snackbar.success('Diseño listo para enviar al carrito')
}
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
      <v-spacer />
      <v-select
        v-model="code"
        :items="PRODUCT_TEMPLATES"
        item-title="name"
        item-value="code"
        label="Producto"
        density="compact"
        hide-details
        style="max-width: 300px"
      />
    </div>

    <ClientOnly>
      <ProductCustomizer
        :key="template.code"
        :template="template"
        @complete="onComplete"
      />
      <template #fallback>
        <v-skeleton-loader
          type="image, actions"
          height="520"
        />
      </template>
    </ClientOnly>

    <v-card
      v-if="result"
      border
      variant="flat"
      class="mt-6"
    >
      <v-card-title class="text-subtitle-1">
        Resultado (lo que se enviará al backend)
      </v-card-title>
      <v-card-text>
        <p class="mb-2">
          {{ result.sizes.join(' · ') }} · JSON: {{ (result.json.length / 1024).toFixed(1) }} KB
        </p>
        <pre class="json">{{ result.json.slice(0, 1200) }}{{ result.json.length > 1200 ? '…' : '' }}</pre>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<style scoped>
.json {
  max-height: 260px;
  overflow: auto;
  padding: 12px;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
  background: var(--nt-bg);
  border-radius: var(--nt-radius-sm);
}
</style>
