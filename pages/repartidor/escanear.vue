<script setup lang="ts">
import type { QrValidationResult } from '~/composables/useQrScanner'
import { useDeliveryService } from '~/features/delivery/services/deliveryService'

definePageMeta({ layout: 'repartidor' })
useHead({ title: 'Escanear · Repartidor' })

const service = useDeliveryService()

/** Escaneo rápido: abre directamente la orden a la que pertenece el QR. */
async function validate(code: string): Promise<QrValidationResult> {
  const order = await service.findByQr(code)
  if (!order) return { ok: false, message: 'Este QR no corresponde a ninguno de tus pedidos.' }
  await navigateTo(`/repartidor/pedido/${order.idOrden}`)
  return { ok: true, message: `Pedido #${order.codigoOrden}` }
}
</script>

<template>
  <div>
    <p class="text-body-2 text-medium-emphasis mb-4">
      Escanea el QR que te muestra el comprador para abrir su pedido.
    </p>
    <ClientOnly>
      <QrScanner
        title="Escanear pedido"
        :validate="validate"
      />
    </ClientOnly>
  </div>
</template>
