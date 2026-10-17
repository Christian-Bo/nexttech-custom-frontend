<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'

interface RecurrenteCallbackData {
  checkoutId?: string
  error?: string
  notice?: string
}
interface RecurrenteWidget {
  load: (options: {
    url: string
    onSuccess: (data: RecurrenteCallbackData) => void
    onFailure: (data: RecurrenteCallbackData) => void
    onPaymentInProgress: (data: RecurrenteCallbackData) => void
  }) => void
}

const props = defineProps<{ checkoutId: string, checkoutUrl: string }>()
const emit = defineEmits<{
  success: [checkoutId: string]
  failure: [message: string]
  pending: []
}>()

// Se fija una versión para evitar cambios inesperados del proveedor.
const RECURRENTE_SCRIPT = 'https://cdn.jsdelivr.net/npm/recurrente-checkout@0.0.5/recurrente-checkout.js'
const loadError = ref('')
const mounting = ref(true)
let active = true
let externalScript: Promise<void> | null = null

function ensureScript(): Promise<void> {
  const w = window as Window & { RecurrenteCheckout?: RecurrenteWidget }
  if (w.RecurrenteCheckout) return Promise.resolve()
  if (externalScript) return externalScript
  externalScript = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${RECURRENTE_SCRIPT}"]`)
    const script = existing ?? document.createElement('script')
    const cleanup = () => {
      script.removeEventListener('load', loaded)
      script.removeEventListener('error', failed)
    }
    const loaded = () => { cleanup(); resolve() }
    const failed = () => { cleanup(); script.remove(); reject(new Error('No se pudo cargar el formulario de pago.')) }
    script.addEventListener('load', loaded, { once: true })
    script.addEventListener('error', failed, { once: true })
    if (!existing) {
      script.src = RECURRENTE_SCRIPT
      script.async = true
      document.head.appendChild(script)
    }
  }).catch((e: unknown) => {
    externalScript = null
    throw e
  })
  return externalScript
}

onMounted(async () => {
  try {
    await ensureScript()
    if (!active) return
    const w = window as Window & { RecurrenteCheckout?: RecurrenteWidget }
    if (!w.RecurrenteCheckout) throw new Error('El formulario de Recurrente no se inicializó.')
    // La biblioteca monta su iframe en el elemento con este ID.
    w.RecurrenteCheckout.load({
      url: props.checkoutUrl,
      onSuccess: (data) => {
        if (active) emit('success', data?.checkoutId || props.checkoutId)
      },
      onFailure: (data) => {
        if (active) emit('failure', data?.notice || data?.error || 'No se completó el pago. Puedes intentarlo de nuevo.')
      },
      onPaymentInProgress: () => {
        if (active) emit('pending')
      }
    })
  }
  catch (e) {
    if (active) loadError.value = e instanceof Error ? e.message : 'No se pudo cargar Recurrente.'
  }
  finally {
    if (active) mounting.value = false
  }
})

onBeforeUnmount(() => { active = false })
</script>

<template>
  <section class="recurrente-box" aria-label="Pago seguro con Recurrente">
    <div class="d-flex align-center ga-2 mb-3">
      <v-icon icon="mdi-shield-lock-outline" color="secondary" />
      <strong>Pago seguro con Recurrente</strong>
    </div>
    <v-progress-linear v-if="mounting" indeterminate color="secondary" class="mb-3" />
    <v-alert v-if="loadError" type="warning" variant="tonal" class="mb-3">
      {{ loadError }} Puedes continuar desde el enlace seguro del proveedor.
    </v-alert>
    <div id="recurrente-checkout-container" class="recurrente-frame" />
    <p class="text-caption text-medium-emphasis mt-3">
      Los datos de tu tarjeta se introducen directamente en Recurrente. NextTech no recibe PAN ni CVV.
    </p>
    <a :href="checkoutUrl" target="_blank" rel="noopener noreferrer" class="external-link text-body-2">
      Abrir pago en Recurrente <v-icon icon="mdi-open-in-new" size="16" />
    </a>
  </section>
</template>

<style scoped>
.recurrente-box { min-width: 0; max-width: 100%; padding: 20px; border: 1px solid rgb(6 182 212 / 30%); border-radius: 16px; background: rgb(30 41 59 / 90%); }
.recurrente-frame { width: 100%; max-width: 100%; min-height: 260px; overflow: hidden; }
.recurrente-frame :deep(iframe) { width: 100%; max-width: 100%; border: 0; }
.external-link { color: #67e8f9; display: inline-flex; align-items: center; gap: 6px; overflow-wrap: anywhere; }
@media (max-width: 600px) { .recurrente-box { padding: 12px; } }
</style>
