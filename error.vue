<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()

const notFound = computed(() => props.error.statusCode === 404)

useHead({
  title: notFound.value ? 'Página no encontrada | NextTech Custom' : 'Error | NextTech Custom'
})
</script>

<template>
  <v-app>
    <v-main class="d-flex align-center justify-center pa-6">
      <div
        class="text-center"
        style="max-width: 440px"
      >
        <p class="error-page__code">
          {{ error.statusCode }}
        </p>
        <h1 class="text-h5 font-weight-bold mt-2">
          {{ notFound ? 'Esta página no existe.' : 'La página no se pudo cargar.' }}
        </h1>
        <p class="mt-3 text-medium-emphasis">
          {{ notFound ? 'Revisa la dirección o vuelve al inicio.' : 'Intenta de nuevo en unos segundos.' }}
        </p>
        <v-btn
          class="mt-8 text-none"
          color="primary"
          variant="flat"
          size="large"
          @click="clearError({ redirect: '/' })"
        >
          Volver al inicio
        </v-btn>
      </div>
    </v-main>
  </v-app>
</template>

<style scoped>
.error-page__code {
  font-size: 5rem;
  font-weight: 800;
  line-height: 1;
  color: var(--nt-primary);
}
</style>