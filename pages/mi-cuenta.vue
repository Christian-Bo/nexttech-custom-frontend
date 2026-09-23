<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
useHead({ title: 'Mi cuenta | NextTech Custom' })

const auth = useAuthStore()
const snackbar = useSnackbar()

async function cerrarSesion() {
  auth.clearSession()
  snackbar.info('Cerraste sesión.')
  await navigateTo('/login')
}
</script>

<template>
  <v-container
    class="py-10"
    style="max-width: 720px"
  >
    <h1 class="text-h4 font-weight-bold">
      Hola, {{ auth.nickname ?? 'comprador' }}
    </h1>
    <p class="text-medium-emphasis mt-2">
      Página temporal para comprobar la sesión. Aquí irá el perfil del comprador.
    </p>

    <v-card
      class="pa-6 mt-8"
      variant="flat"
      border
      rounded="lg"
    >
      <dl class="session">
        <dt class="text-medium-emphasis">
          Tipo de usuario
        </dt>
        <dd>{{ auth.actorType }}</dd>

        <dt class="text-medium-emphasis">
          Id de comprador
        </dt>
        <dd>{{ auth.buyerId ?? '—' }}</dd>

        <dt class="text-medium-emphasis">
          Debe cambiar contraseña
        </dt>
        <dd>{{ auth.mustChangePassword ? 'Sí' : 'No' }}</dd>
      </dl>

      <v-btn
        class="mt-6 mr-3 text-none"
        color="primary"
        to="/mi-foto"
        prepend-icon="mdi-account-box-outline"
      >
        Mi foto y credencial
      </v-btn>

      <v-btn
        class="mt-6 text-none"
        color="primary"
        variant="outlined"
        prepend-icon="mdi-logout"
        @click="cerrarSesion"
      >
        Cerrar sesión
      </v-btn>
    </v-card>
  </v-container>
</template>

<style scoped>
.session {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.5rem 1.5rem;
  margin: 0;
}

.session dd {
  margin: 0;
  font-weight: 600;
}
</style>