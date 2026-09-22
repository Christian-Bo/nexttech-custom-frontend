<script setup lang="ts">
import { computed } from 'vue'
import type { SnackbarType } from '~/composables/useSnackbar'

const { current, dismiss } = useSnackbar()

const ICONS: Record<SnackbarType, string> = {
  success: 'mdi-check-circle-outline',
  error: 'mdi-alert-circle-outline',
  warning: 'mdi-alert-outline',
  info: 'mdi-information-outline'
}

const visible = computed({
  get: () => current.value !== null,
  set: (open: boolean) => {
    if (!open && current.value) dismiss(current.value.id)
  }
})
</script>

<template>
  <v-snackbar
    v-if="current"
    :key="current.id"
    v-model="visible"
    :color="current.type"
    :timeout="current.timeout"
    location="bottom right"
    variant="flat"
    rounded="lg"
    :role="current.type === 'error' ? 'alert' : 'status'"
  >
    <div class="d-flex align-center ga-3">
      <v-icon :icon="ICONS[current.type]" />
      <span>{{ current.message }}</span>
    </div>

    <template #actions>
      <v-btn
        icon="mdi-close"
        variant="text"
        size="small"
        aria-label="Cerrar aviso"
        @click="dismiss(current.id)"
      />
    </template>
  </v-snackbar>
</template>
