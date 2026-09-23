<script setup lang="ts">
import DeliveryOrderDetail from '~/features/delivery/components/DeliveryOrderDetail.vue'

definePageMeta({ layout: 'repartidor', middleware: 'repartidor' })

// El parámetro es el CÓDIGO de la orden (p. ej. ORD-1A2B3C4D).
const route = useRoute()
const codigo = decodeURIComponent(String(route.params.id))
useHead({ title: `Pedido ${codigo} · Repartidor` })
</script>

<template>
  <ClientOnly>
    <DeliveryOrderDetail :codigo-orden="codigo" />
  </ClientOnly>
</template>
