<script setup lang="ts">
import { useAuthService } from '~/services/authService'
import { isApiError } from '~/services/api'

definePageMeta({ layout: 'auth' })
useHead({ title: 'Crear cuenta | NextTech Custom' })

const auth = useAuthStore()
const authService = useAuthService()
const snackbar = useSnackbar()

/** Credencial QR devuelta por el backend; la usa la pantalla de credencial. */
const credencial = useState<string | null>('nt-registro-credencial', () => null)

const form = reactive({
  email: '',
  phone: '',
  nickname: '',
  password: '',
  passwordConfirm: '',
  birthDate: '',
  notifyByEmail: true,
  notifyByWhatsApp: false
})

const showPassword = ref(false)
const loading = ref(false)
const errorMessage = ref('')

/** Reglas alineadas con las validaciones del backend. */
const rules = {
  required: (v: string) => !!v?.trim() || 'Este campo es obligatorio.',
  email: (v: string) =>
    (v.includes('@') && v.trim().length <= 150) || 'Escribe un correo válido.',
  phone: (v: string) => v.trim().length <= 25 || 'Máximo 25 caracteres.',
  nickname: (v: string) => v.trim().length <= 50 || 'Máximo 50 caracteres.',
  passwordLength: (v: string) => (v.length >= 8 && v.length <= 128) || 'Entre 8 y 128 caracteres.',
  passwordStrength: (v: string) =>
    (/[A-Z]/.test(v) && /[a-z]/.test(v) && /\d/.test(v))
    || 'Debe incluir mayúscula, minúscula y número.'
}

const passwordsMatch = computed(() =>
  !form.passwordConfirm || form.password === form.passwordConfirm
)

const algunCanal = computed(() => form.notifyByEmail || form.notifyByWhatsApp)

/** Nadie menor de edad ni fechas futuras. */
const maxBirthDate = new Date().toISOString().slice(0, 10)

function validar(): string | null {
  if (!form.email.trim() || !form.phone.trim() || !form.nickname.trim() || !form.password) {
    return 'Completa todos los campos obligatorios.'
  }
  if (!form.email.includes('@')) return 'Escribe un correo válido.'
  if (form.password.length < 8 || form.password.length > 128) {
    return 'La contraseña debe tener entre 8 y 128 caracteres.'
  }
  if (!/[A-Z]/.test(form.password) || !/[a-z]/.test(form.password) || !/\d/.test(form.password)) {
    return 'La contraseña debe incluir mayúscula, minúscula y número.'
  }
  if (form.password !== form.passwordConfirm) return 'Las contraseñas no coinciden.'
  if (!algunCanal.value) return 'Elige al menos un canal de notificación.'
  return null
}

async function crearCuenta() {
  errorMessage.value = ''

  const problema = validar()
  if (problema) {
    errorMessage.value = problema
    return
  }

  loading.value = true
  try {
    const result = await authService.register({
      email: form.email.trim(),
      phone: form.phone.trim(),
      nickname: form.nickname.trim(),
      password: form.password,
      birthDate: form.birthDate || null,
      notifyByEmail: form.notifyByEmail,
      notifyByWhatsApp: form.notifyByWhatsApp
    })

    // El registro deja la sesión iniciada.
    auth.setSession(result.token)
    credencial.value = result.qrCredential

    snackbar.success('Tu cuenta fue creada. Te enviamos tu credencial.')
    await navigateTo('/mi-cuenta')
  }
  catch (error) {
    errorMessage.value = isApiError(error) ? error.message : 'No se pudo crear la cuenta.'
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <div>
    <!-- Avance del registro: los pasos 2 y 3 se construyen después -->
    <ol class="pasos">
      <li class="pasos__item pasos__item--activo">
        <span class="pasos__num">1</span> Datos
      </li>
      <li class="pasos__item">
        <span class="pasos__num">2</span> Foto
      </li>
      <li class="pasos__item">
        <span class="pasos__num">3</span> Credencial
      </li>
    </ol>

    <h1 class="text-h4 font-weight-bold mb-2">
      Crea tu cuenta
    </h1>
    <p class="text-medium-emphasis mb-6">
      Con una sola cuenta compras, sigues tu pedido y lo recibes en el campus.
    </p>

    <v-form @submit.prevent="crearCuenta">
      <v-text-field
        v-model="form.email"
        label="Correo electrónico"
        type="email"
        autocomplete="email"
        prepend-inner-icon="mdi-email-outline"
        variant="outlined"
        color="accent"
        :rules="[rules.required, rules.email]"
        :disabled="loading"
      />

      <v-text-field
        v-model="form.phone"
        label="Teléfono"
        type="tel"
        autocomplete="tel"
        prepend-inner-icon="mdi-whatsapp"
        variant="outlined"
        color="accent"
        hint="Para avisarte por WhatsApp, si lo activas abajo."
        :rules="[rules.required, rules.phone]"
        :disabled="loading"
      />

      <v-text-field
        v-model="form.nickname"
        label="Nickname"
        autocomplete="username"
        prepend-inner-icon="mdi-account-outline"
        variant="outlined"
        color="accent"
        hint="Así te identificamos al iniciar sesión."
        :rules="[rules.required, rules.nickname]"
        :disabled="loading"
      />

      <v-text-field
        v-model="form.birthDate"
        label="Fecha de nacimiento (opcional)"
        type="date"
        prepend-inner-icon="mdi-cake-variant-outline"
        variant="outlined"
        color="accent"
        :max="maxBirthDate"
        :disabled="loading"
      />

      <v-text-field
        v-model="form.password"
        label="Contraseña"
        autocomplete="new-password"
        prepend-inner-icon="mdi-lock-outline"
        variant="outlined"
        color="accent"
        :type="showPassword ? 'text' : 'password'"
        :append-inner-icon="showPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
        hint="Mínimo 8 caracteres, con mayúscula, minúscula y número."
        :rules="[rules.required, rules.passwordLength, rules.passwordStrength]"
        :disabled="loading"
        @click:append-inner="showPassword = !showPassword"
      />

      <v-text-field
        v-model="form.passwordConfirm"
        label="Repite la contraseña"
        autocomplete="new-password"
        prepend-inner-icon="mdi-lock-check-outline"
        variant="outlined"
        color="accent"
        :type="showPassword ? 'text' : 'password'"
        :error-messages="passwordsMatch ? [] : ['Las contraseñas no coinciden.']"
        :disabled="loading"
      />

      <fieldset class="canales">
        <legend class="text-body-2 text-medium-emphasis mb-1">
          ¿Cómo quieres recibir tus avisos?
        </legend>
        <v-checkbox
          v-model="form.notifyByEmail"
          label="Correo electrónico"
          color="accent"
          density="compact"
          hide-details
          :disabled="loading"
        />
        <v-checkbox
          v-model="form.notifyByWhatsApp"
          label="WhatsApp"
          color="accent"
          density="compact"
          hide-details
          :disabled="loading"
        />
        <p
          v-if="!algunCanal"
          class="text-caption text-error mt-1"
        >
          Elige al menos uno.
        </p>
      </fieldset>

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
        Crear cuenta
      </v-btn>
    </v-form>

    <p class="text-center mt-8">
      ¿Ya tienes cuenta?
      <NuxtLink to="/login">Inicia sesión</NuxtLink>
    </p>
  </div>
</template>

<style scoped>
.pasos {
  display: flex;
  gap: 1rem;
  margin: 0 0 1.5rem;
  padding: 0;
  list-style: none;
  font-size: 0.875rem;
  color: var(--nt-text-muted);
}

.pasos__item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.pasos__item--activo {
  color: var(--nt-text);
  font-weight: 600;
}

.pasos__num {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border: 1px solid currentcolor;
  border-radius: 50%;
  font-size: 0.75rem;
}

.pasos__item--activo .pasos__num {
  background-color: var(--nt-primary);
  border-color: var(--nt-primary);
  color: var(--nt-text);
}

.canales {
  margin: 0 0 1.5rem;
  padding: 0;
  border: 0;
}
</style>