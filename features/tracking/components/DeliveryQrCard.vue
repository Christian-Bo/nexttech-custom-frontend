<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'

/** QR que el comprador muestra al repartidor para recibir su pedido. */
const props = defineProps<{ value: string, codigoOrden: string }>()

const dataUrl = ref<string | null>(null)
const expanded = ref(false)

async function render(): Promise<void> {
  const QRCode = (await import('qrcode')).default
  dataUrl.value = await QRCode.toDataURL(props.value, {
    margin: 1,
    width: 480,
    errorCorrectionLevel: 'M',
    color: { dark: '#0F172A', light: '#FFFFFF' }
  })
}

onMounted(render)
watch(() => props.value, render)
</script>

<template>
  <v-card
    border
    variant="flat"
    class="pa-4 text-center"
  >
    <div class="d-flex align-center ga-2 mb-3">
      <v-icon
        icon="mdi-qrcode"
        color="accent"
      />
      <strong>Tu QR de entrega</strong>
      <v-spacer />
      <v-btn
        size="small"
        variant="text"
        :prepend-icon="expanded ? 'mdi-fullscreen-exit' : 'mdi-fullscreen'"
        @click="expanded = true"
      >
        Ampliar
      </v-btn>
    </div>
    <img
      v-if="dataUrl"
      :src="dataUrl"
      :alt="`Código QR de entrega del pedido ${codigoOrden}`"
      class="qr"
    >
    <v-skeleton-loader
      v-else
      type="image"
      height="200"
    />
    <p class="text-body-2 text-medium-emphasis mt-3">
      Muéstraselo al repartidor al recibir tu pedido. Es de un solo uso.
    </p>

    <v-dialog
      v-model="expanded"
      max-width="420"
    >
      <v-card class="pa-6 text-center qr-full">
        <img
          v-if="dataUrl"
          :src="dataUrl"
          :alt="`Código QR de entrega del pedido ${codigoOrden}`"
        >
        <div class="mt-3 font-weight-bold">
          #{{ codigoOrden }}
        </div>
        <v-btn
          class="mt-4"
          variant="tonal"
          @click="expanded = false"
        >
          Cerrar
        </v-btn>
      </v-card>
    </v-dialog>
  </v-card>
</template>

<style scoped>
.qr {
  width: 200px;
  height: 200px;
  border-radius: var(--nt-radius-md);
  background: #fff;
  padding: 8px;
}

.qr-full {
  background: #fff !important;
  color: #0f172a;
}

.qr-full img {
  width: 100%;
}
</style>
