<script setup lang="ts">
import { computed } from 'vue'

/** Indicador de la conexión en vivo. Montar donde haya datos en tiempo real. */
const { status, mode, reconnect } = useRealtime()

const view = computed(() => {
  switch (status.value) {
    case 'connected': return { text: mode === 'polling' ? 'Actualización automática' : 'En vivo', color: 'success', live: true }
    case 'connecting': return { text: 'Conectando…', color: 'info', live: false }
    case 'reconnecting': return { text: 'Reconectando…', color: 'warning', live: false }
    case 'disconnected': return { text: 'Sin conexión', color: 'error', live: false }
    default: return { text: 'Inactivo', color: undefined, live: false }
  }
})
</script>

<template>
  <v-chip
    size="small"
    variant="tonal"
    :color="view.color"
    role="status"
    :aria-label="`Tiempo real: ${view.text}`"
  >
    <span
      class="dot"
      :class="{ 'dot--live': view.live }"
      aria-hidden="true"
    />
    {{ view.text }}
    <v-btn
      v-if="status === 'disconnected'"
      size="x-small"
      variant="text"
      icon="mdi-refresh"
      aria-label="Reconectar"
      class="ml-1"
      @click="reconnect"
    />
  </v-chip>
</template>

<style scoped>
.dot {
  width: 8px;
  height: 8px;
  margin-right: 6px;
  border-radius: 50%;
  background: currentcolor;
}

.dot--live {
  animation: pulse 1.6s ease-out infinite;
}

@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgb(34 197 94 / 60%); }
  100% { box-shadow: 0 0 0 8px rgb(34 197 94 / 0%); }
}
</style>
