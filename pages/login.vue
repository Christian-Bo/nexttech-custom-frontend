<script setup lang="ts">
import { useAuthService } from '~/services/auth/auth.service'
import { isApiError } from '~/services/api'

definePageMeta({ layout: 'auth' })
useHead({ title: 'Iniciar sesión | NextTech Custom' })

const route = useRoute()
const auth = useAuthStore()
const authService = useAuthService()
const snackbar = useSnackbar()

const identifier = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)
const errorMessage = ref('')

/** Si ya hay sesión, no tiene sentido mostrar el formulario. */
onMounted(() => {
  if (auth.isAuthenticated) navigateTo('/mi-cuenta')
})

const rules = {
  required: (value: string) => !!value?.trim() || 'Este campo es obligatorio.'
}

async function iniciarSesion() {
  errorMessage.value = ''

  if (!identifier.value.trim() || !password.value) {
    errorMessage.value = 'Ingresa tu usuario y tu contraseña.'
    return
  }

  loading.value = true
  try {
    const result = await authService.login(identifier.value.trim(), password.value)
    auth.setSession(result)

    if (result.mustChangePassword) {
      snackbar.warning('Debes cambiar tu contraseña.')
    }

    // El plugin de API guarda a dónde iba el usuario antes de expirar la sesión.
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : null
    await navigateTo(redirect ?? '/mi-cuenta')
  }
  catch (error) {
    errorMessage.value = isApiError(error) ? error.message : 'No se pudo iniciar sesión.'
  }
  finally {
    loading.value = false
  }
}

/* ----- Recuperación de contraseña ----- */
const resetOpen = ref(false)
const resetEmail = ref('')
const resetLoading = ref(false)
const resetDone = ref(false)

async function enviarRecuperacion() {
  if (!resetEmail.value.trim()) return

  resetLoading.value = true
  try {
    await authService.forgotPassword(resetEmail.value.trim())
  }
  catch (error) {
    // El backend responde igual exista o no la cuenta; solo avisamos si falla la red.
    if (isApiError(error) && error.status === 0) {
      snackbar.error(error)
      resetLoading.value = false
      return
    }
  }
  resetLoading.value = false
  resetDone.value = true
}

function cerrarRecuperacion() {
  resetOpen.value = false
  resetDone.value = false
  resetEmail.value = ''
}
</script>

<template>
  <div>
    <h1 class="text-h4 font-weight-bold mb-2">
      Inicia sesión
    </h1>
    <p class="text-medium-emphasis mb-6">
      Entra con tu usuario o el correo con el que te registraste.
    </p>

    <v-alert
      v-if="route.query.redirect"
      type="info"
      variant="tonal"
      density="comfortable"
      class="mb-4"
    >
      Inicia sesión para continuar.
    </v-alert>

    <v-form @submit.prevent="iniciarSesion">
      <v-text-field
        v-model="identifier"
        label="Usuario o correo"
        autocomplete="username"
        prepend-inner-icon="mdi-account-outline"
        variant="outlined"
        color="accent"
        :rules="[rules.required]"
        :disabled="loading"
      />

      <v-text-field
        v-model="password"
        label="Contraseña"
        autocomplete="current-password"
        prepend-inner-icon="mdi-lock-outline"
        variant="outlined"
        color="accent"
        :type="showPassword ? 'text' : 'password'"
        :append-inner-icon="showPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
        :rules="[rules.required]"
        :disabled="loading"
        @click:append-inner="showPassword = !showPassword"
      />

      <div class="d-flex justify-end mb-2">
        <v-btn
          variant="text"
          size="small"
          class="text-none"
          @click="resetOpen = true"
        >
          Olvidé mi contraseña
        </v-btn>
      </div>

      <v-alert
        v-if="errorMessage"
        type="error"
        variant="tonal"
        density="comfortable"
        class="mb-4"
      >
        {{ errorMessage }}
      </v-alert>

      <v-btn
        type="submit"
        color="primary"
        variant="flat"
        size="large"
        block
        class="text-none"
        :loading="loading"
      >
        Iniciar sesión
      </v-btn>
    </v-form>

    <p class="text-center mt-8">
      ¿No tienes cuenta?
      <NuxtLink to="/registro">Créala aquí</NuxtLink>
    </p>

    <!-- Recuperación de contraseña -->
    <v-dialog
      v-model="resetOpen"
      max-width="460"
    >
      <v-card
        rounded="lg"
        border
      >
        <v-card-title class="text-h6 pt-5 px-6">
          Recuperar contraseña
        </v-card-title>

        <v-card-text
          v-if="!resetDone"
          class="px-6"
        >
          <p class="text-medium-emphasis mb-4">
            Escribe tu correo registrado y te enviaremos un enlace para crear una contraseña nueva.
          </p>
          <v-text-field
            v-model="resetEmail"
            label="Correo electrónico"
            type="email"
            autocomplete="email"
            variant="outlined"
            color="accent"
            autofocus
            @keyup.enter="enviarRecuperacion"
          />
        </v-card-text>

        <v-card-text
          v-else
          class="px-6 text-medium-emphasis"
        >
          Si el correo corresponde a una cuenta, ya enviamos el enlace. Revisa tu bandeja de entrada.
        </v-card-text>

        <v-card-actions class="px-6 pb-5">
          <v-spacer />
          <v-btn
            variant="text"
            class="text-none"
            @click="cerrarRecuperacion"
          >
            {{ resetDone ? 'Entendido' : 'Cancelar' }}
          </v-btn>
          <v-btn
            v-if="!resetDone"
            color="primary"
            variant="flat"
            class="text-none"
            :loading="resetLoading"
            @click="enviarRecuperacion"
          >
            Enviar enlace
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>