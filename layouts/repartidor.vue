<script setup lang="ts">
import { computed } from 'vue'

/** Shell móvil del repartidor: barra superior + navegación inferior. */
const route = useRoute()
const online = useOnline()

const nav = computed(() => {
  if (route.path.startsWith('/repartidor/escanear')) return 'scan'
  return 'orders'
})

function useOnline() {
  const state = ref(true)
  onMounted(() => {
    const update = () => (state.value = navigator.onLine)
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    onBeforeUnmount(() => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    })
  })
  return state
}
</script>

<template>
  <v-app>
    <v-app-bar
      color="surface"
      flat
      border="b"
      density="comfortable"
    >
      <v-app-bar-title>
        <NuxtLink
          to="/repartidor"
          class="brand"
        >
          <span>Next</span><span class="brand__tech">Tech</span>
          <span class="brand__role">Repartidor</span>
        </NuxtLink>
      </v-app-bar-title>
      <template #append>
        <v-chip
          size="small"
          variant="tonal"
          :color="online ? 'success' : 'error'"
          :prepend-icon="online ? 'mdi-wifi' : 'mdi-wifi-off'"
          class="mr-2"
        >
          {{ online ? 'En línea' : 'Sin conexión' }}
        </v-chip>
      </template>
    </v-app-bar>

    <v-main>
      <div class="shell">
        <slot />
      </div>
    </v-main>

    <v-bottom-navigation
      :model-value="nav"
      color="primary"
      grow
      border="t"
      bg-color="surface"
    >
      <v-btn
        value="orders"
        to="/repartidor"
      >
        <v-icon icon="mdi-package-variant-closed" />
        <span>Pedidos</span>
      </v-btn>
      <v-btn
        value="scan"
        to="/repartidor/escanear"
      >
        <v-icon icon="mdi-magnify-scan" />
        <span>Buscar</span>
      </v-btn>
    </v-bottom-navigation>

    <AppSnackbar />
    <ConfirmDialog />
  </v-app>
</template>

<style scoped>
.shell {
  max-width: 560px;
  margin: 0 auto;
  padding: 16px 16px 24px;
}

.brand {
  color: var(--nt-text);
  text-decoration: none;
  font-weight: 700;
}

.brand__tech {
  color: var(--nt-accent);
}

.brand__role {
  margin-left: 0.4rem;
  font-weight: 500;
  color: var(--nt-text-muted);
}
</style>
