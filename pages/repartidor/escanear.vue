<script setup lang="ts">
import { ref } from 'vue'
import type { QrValidationResult } from '~/composables/useQrScanner'
import { useDeliveryService } from '~/features/delivery/services/deliveryService'

definePageMeta({ layout: 'repartidor', middleware: 'repartidor' })
useHead({ title: 'Buscar pedido · Repartidor' })

const service = useDeliveryService()
const code = ref('')
const searching = ref(false)
const notFound = ref(false)

/** Enunciado 4.a: buscar una compra por teclado o escaneando el QR. */
async function open(input: string): Promise<boolean> {
  const order = await service.findByQr(input)
  if (!order) return false
  await navigateTo(`/repartidor/pedido/${order.idOrden}`)
  return true
}

async function search(): Promise<void> {
  if (!code.value.trim()) return
  searching.value = true
  notFound.value = false
  try {
    notFound.value = !(await open(code.value))
  }
  finally {
    searching.value = false
  }
}

async function validate(qr: string): Promise<QrValidationResult> {
  return (await open(qr))
    ? { ok: true, message: 'Abriendo pedido…' }
    : { ok: false, message: 'Este QR no corresponde a ninguno de tus pedidos.' }
}
</script>

<template>
  <div class="d-flex flex-column ga-5">
    <section>
      <h1 class="text-h6 font-weight-bold mb-1">
        Buscar pedido
      </h1>
      <p class="text-body-2 text-medium-emphasis mb-3">
        Escribe el código del pedido o escanea el QR del comprador.
      </p>
      <form
        class="d-flex ga-2"
        @submit.prevent="search"
      >
        <v-text-field
          v-model="code"
          label="Código del pedido"
          placeholder="NTC-1042"
          prepend-inner-icon="mdi-magnify"
          autocomplete="off"
          :error-messages="notFound ? 'No encontramos ese pedido entre tus asignados.' : undefined"
          @update:model-value="notFound = false"
        />
        <v-btn
          type="submit"
          color="primary"
          size="large"
          :loading="searching"
          :disabled="!code.trim()"
        >
          Buscar
        </v-btn>
      </form>
    </section>

    <v-divider>
      <span class="text-caption text-medium-emphasis px-2">o</span>
    </v-divider>

    <ClientOnly>
      <QrScanner
        title="Escanear QR del pedido"
        :validate="validate"
        :auto-start="false"
      />
    </ClientOnly>
  </div>
</template>
