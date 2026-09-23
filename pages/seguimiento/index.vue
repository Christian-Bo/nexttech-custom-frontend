<script setup lang="ts">
import { ref } from 'vue'

useHead({ title: 'Seguimiento · NextTech Custom' })

const code = ref('')
const config = useRuntimeConfig()

function go(): void {
  const c = code.value.trim().toUpperCase()
  if (c) void navigateTo(`/seguimiento/${encodeURIComponent(c)}`)
}
</script>

<template>
  <v-container
    class="py-12"
    style="max-width: 520px"
  >
    <v-icon
      icon="mdi-map-marker-path"
      size="48"
      color="primary"
      class="mb-3"
    />
    <h1 class="text-h5 font-weight-bold mb-1">
      Sigue tu pedido
    </h1>
    <p class="text-medium-emphasis mb-6">
      Escribe el código de tu pedido. Lo encuentras en "Mis pedidos" o en el correo de confirmación.
    </p>
    <form
      class="d-flex ga-2"
      @submit.prevent="go"
    >
      <v-text-field
        v-model="code"
        label="Código del pedido"
        placeholder="NTC-1042"
        prepend-inner-icon="mdi-pound"
        hide-details
        autocomplete="off"
      />
      <v-btn
        type="submit"
        color="primary"
        size="large"
        :disabled="!code.trim()"
      >
        Ver
      </v-btn>
    </form>
    <p
      v-if="config.public.useMocks"
      class="text-caption text-medium-emphasis mt-4"
    >
      Demo: prueba NTC-1046 (recibido), NTC-1045 (en elaboración), NTC-1042 (listo) o NTC-1044 (en camino).
    </p>
  </v-container>
</template>
