<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAuthService } from '~/services/authService'
import { isApiError } from '~/services/api'

/**
 * Restablecer contraseña con el enlace del correo: /restablecer-contrasena?token=...
 * (el backend arma el enlace con RecoveryUrlBase). El token es de un solo uso y vence en 30 min.
 */
definePageMeta({ layout: 'auth' })
useHead({ title: 'Nueva contraseña | NextTech Custom' })

const route = useRoute()
const router = useRouter()
const snackbar = useSnackbar()
const authService = useAuthService()
const useMocks = !!useRuntimeConfig().public.useMocks

const token = ref('')
const password = ref('')
const confirmPassword = ref('')
const show = ref(false)
const loading = ref(false)
const errorMessage = ref('')
const expired = ref(false)

const rules = {
  password: (v: string) =>
    (v.length >= 8 && v.length <= 128 && /[A-Z]/.test(v) && /[a-z]/.test(v) && /\d/.test(v))
    || 'Entre 8 y 128 caracteres, con mayúscula, minúscula y número.',
  same: (v: string) => v === password.value || 'Las contraseñas no coinciden.'
}

const valid = computed(() => rules.password(password.value) === true && password.value === confirmPassword.value)

onMounted(() => {
  token.value = typeof route.query.token === 'string' ? route.query.token : ''
  // Se quita el token de la barra de direcciones para que no quede en el historial.
  if (token.value) void router.replace({ query: {} })
})

async function submit(): Promise<void> {
  errorMessage.value = ''
  if (!valid.value) return
  loading.value = true
  try {
    if (!useMocks) await authService.resetPassword({ token: token.value, newPassword: password.value })
    token.value = ''
    snackbar.success('Tu contraseña se cambió. Ya puedes iniciar sesión.')
    await navigateTo('/login')
  }
  catch (e) {
    if (isApiError(e) && e.status === 400) {
      expired.value = true
      errorMessage.value = 'El enlace no es válido o ya venció. Pide uno nuevo desde "¿Olvidaste tu contraseña?".'
    }
    else {
      errorMessage.value = isApiError(e) ? e.message : 'No se pudo cambiar la contraseña.'
    }
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <div>
    <h1 class="text-h4 font-weight-bold mb-2">
      Crea una nueva contraseña
    </h1>
    <p class="text-medium-emphasis mb-6">
      Elige una contraseña que no hayas usado antes.
    </p>

    <v-alert
      v-if="!token && !useMocks"
      type="warning"
      variant="tonal"
      class="mb-4"
    >
      Abre esta página desde el enlace que te enviamos por correo.
    </v-alert>

    <v-alert
      v-if="errorMessage"
      type="error"
      variant="tonal"
      class="mb-4"
    >
      {{ errorMessage }}
    </v-alert>

    <v-form @submit.prevent="submit">
      <v-text-field
        v-model="password"
        label="Nueva contraseña"
        :type="show ? 'text' : 'password'"
        autocomplete="new-password"
        prepend-inner-icon="mdi-lock-outline"
        :append-inner-icon="show ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
        variant="outlined"
        color="accent"
        :rules="[rules.password]"
        :disabled="loading || (!token && !useMocks)"
        @click:append-inner="show = !show"
      />
      <v-text-field
        v-model="confirmPassword"
        label="Confirmar contraseña"
        :type="show ? 'text' : 'password'"
        autocomplete="new-password"
        prepend-inner-icon="mdi-lock-check-outline"
        variant="outlined"
        color="accent"
        :rules="[rules.same]"
        :disabled="loading || (!token && !useMocks)"
      />
      <v-btn
        type="submit"
        color="primary"
        size="large"
        block
        class="text-none mt-2"
        :loading="loading"
        :disabled="!valid || (!token && !useMocks)"
      >
        Guardar contraseña
      </v-btn>
    </v-form>

    <div class="text-center mt-6">
      <NuxtLink
        to="/login"
        class="text-accent"
      >
        {{ expired ? 'Pedir un enlace nuevo' : 'Volver a iniciar sesión' }}
      </NuxtLink>
    </div>
  </div>
</template>
