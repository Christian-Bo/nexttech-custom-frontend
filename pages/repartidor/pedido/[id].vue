<script setup lang="ts">
import DeliveryOrderDetail from '~/features/delivery/components/DeliveryOrderDetail.vue'

definePageMeta({ layout: 'repartidor', middleware: 'repartidor' })

const route = useRoute()
const id = Number(route.params.id)
useHead({ title: `Pedido ${id} · Repartidor` })
</script>

<template>
  <ClientOnly>
    <DeliveryOrderDetail :id-orden="id" />
  </ClientOnly>
</template>
