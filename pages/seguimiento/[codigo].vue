<script setup lang="ts">
import OrderTrackingView from '~/features/tracking/components/OrderTrackingView.vue'

// El comprador debe estar autenticado (en modo simulado se permite para la demo).
definePageMeta({
  middleware: [
    (to) => {
      if (useRuntimeConfig().public.useMocks) return
      if (!useAuthStore().isAuthenticated) return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
    }
  ]
})

const route = useRoute()
const codigo = String(route.params.codigo)
useHead({ title: `Pedido ${codigo} · NextTech Custom` })
</script>

<template>
  <v-container
    class="py-8"
    style="max-width: 1000px"
  >
    <ClientOnly>
      <OrderTrackingView :codigo-orden="codigo" />
    </ClientOnly>
  </v-container>
</template>
