<script setup lang="ts">
import { computed } from 'vue'
import type { ApiError } from '~/types/api'

const props = withDefaults(defineProps<{
  /** ApiError normalizado o texto. Nunca se muestra detalle técnico. */
  error?: ApiError | string | null
  title?: string
  retryable?: boolean
  retrying?: boolean
}>(), {
  error: null,
  title: 'Algo salió mal',
  retryable: true,
  retrying: false
})

const emit = defineEmits<{ retry: [] }>()

const message = computed(() => {
  if (!props.error) return 'No pudimos cargar esta información.'
  return typeof props.error === 'string' ? props.error : props.error.message
})
</script>

<template>
  <div
    class="state-error"
    role="alert"
  >
    <v-icon
      icon="mdi-alert-circle-outline"
      size="56"
      color="error"
      class="mb-2"
    />
    <h3 class="text-h6 font-weight-semibold">
      {{ title }}
    </h3>
    <p class="text-body-2 text-medium-emphasis">
      {{ message }}
    </p>
    <v-btn
      v-if="retryable"
      class="mt-2"
      variant="tonal"
      color="primary"
      prepend-icon="mdi-refresh"
      :loading="retrying"
      @click="emit('retry')"
    >
      Reintentar
    </v-btn>
  </div>
</template>

<style scoped>
.state-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 3rem 1rem;
  text-align: center;
}
</style>
