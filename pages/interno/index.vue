<script setup lang="ts">
import { computed, ref } from 'vue'
import { isApiError } from '~/services/api'
import { useInternalAuthService } from '~/services/internalAuthService'
import { useAuthStore } from '~/stores/auth'
import { INTERNAL_ROLES } from '~/types/auth'

/** Acceso del personal (repartidor, supervisor, administrador). */
useHead({ title: 'Acceso del personal · NextTech Custom' })

const auth = useAuthStore()
const service = useInternalAuthService()
const route = useRoute()
const snackbar = useSnackbar()

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)
const error = ref<string | null>(null)

// Cambio obligatorio de contraseña
const newPassword = ref('')
const confirmPassword = ref('')
const changing = ref(false)
const mustChange = computed(() => auth.isInternal && auth.mustChangePassword)

const rules = computed(() => {
  const p = newPassword.value
  return [
    { ok: p.length >= 8, text: 'Al menos 8 caracteres' },
    { ok: /[A-Z]/.test(p), text: 'Una mayúscula' },
    { ok: /[a-z]/.test(p), text: 'Una minúscula' },
    { ok: /\d/.test(p), text: 'Un número' },
    { ok: p.length > 0 && p === confirmPassword.value, text: 'Las contraseñas coinciden' }
  ]
})
const canChange = computed(() => rules.value.every(r => r.ok))

function destination(): string {
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : null
  if (redirect?.startsWith('/')) return redirect
  if (auth.hasRole(INTERNAL_ROLES.DELIVERY_DRIVER)) return '/repartidor'
  return '/panel'
}

async function login(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    auth.setSession(await service.login({ email: email.value.trim(), password: password.value }))
    if (!auth.isInternal) {
      auth.clearSession()
      error.value = 'Esta cuenta no pertenece al personal.'
      return
    }
    if (!auth.mustChangePassword) await navigateTo(destination())
  }
  catch (e) {
    const status = isApiError(e) ? e.status : 0
    error.value = status === 401
      ? 'Correo o contraseña incorrectos.'
      : status === 403 || status === 423
        ? 'Tu cuenta está bloqueada temporalmente. Inténtalo en unos minutos.'
        : isApiError(e) ? e.message : 'No se pudo iniciar sesión.'
  }
  finally {
    loading.value = false
  }
}

async function changePassword(): Promise<void> {
  if (!canChange.value) return
  changing.value = true
  error.value = null
  try {
    await service.changePassword(password.value, newPassword.value)
    // Nuevo token sin la marca "debe cambiar contraseña".
    auth.setSession(await service.login({ email: email.value.trim(), password: newPassword.value }))
    password.value = ''
    snackbar.success('Contraseña actualizada')
    await navigateTo(destination())
  }
  catch (e) {
    error.value = isApiError(e) ? e.message : 'No se pudo cambiar la contraseña.'
  }
  finally {
    changing.value = false
  }
}
</script>

<template>
  <v-container
    class="py-12"
    style="max-width: 440px"
  >
    <div class="text-center mb-6">
      <v-icon
        icon="mdi-badge-account-horizontal-outline"
        size="48"
        color="primary"
      />
      <h1 class="text-h5 font-weight-bold mt-2">
        {{ mustChange ? 'Crea tu nueva contraseña' : 'Acceso del personal' }}
      </h1>
      <p class="text-body-2 text-medium-emphasis">
        {{ mustChange ? 'Por seguridad, debes cambiar la contraseña temporal.' : 'Repartidores, supervisores y administradores.' }}
      </p>
    </div>

    <v-alert
      v-if="error"
      type="error"
      variant="tonal"
      density="compact"
      class="mb-4"
    >
      {{ error }}
    </v-alert>

    <!-- Cambio obligatorio -->
    <form
      v-if="mustChange"
      class="d-flex flex-column ga-3"
      @submit.prevent="changePassword"
    >
      <v-text-field
        v-model="newPassword"
        label="Nueva contraseña"
        type="password"
        autocomplete="new-password"
        prepend-inner-icon="mdi-lock-outline"
        hide-details
      />
      <v-text-field
        v-model="confirmPassword"
        label="Repite la contraseña"
        type="password"
        autocomplete="new-password"
        prepend-inner-icon="mdi-lock-check-outline"
        hide-details
      />
      <ul class="rules">
        <li
          v-for="r in rules"
          :key="r.text"
          :class="{ ok: r.ok }"
        >
          <v-icon
            :icon="r.ok ? 'mdi-check-circle' : 'mdi-circle-outline'"
            size="16"
          />
          {{ r.text }}
        </li>
      </ul>
      <v-btn
        type="submit"
        color="primary"
        size="large"
        :loading="changing"
        :disabled="!canChange"
      >
        Guardar y continuar
      </v-btn>
    </form>

    <!-- Login -->
    <form
      v-else
      class="d-flex flex-column ga-3"
      @submit.prevent="login"
    >
      <v-text-field
        v-model="email"
        label="Correo institucional"
        type="email"
        autocomplete="username"
        prepend-inner-icon="mdi-email-outline"
        hide-details
      />
      <v-text-field
        v-model="password"
        label="Contraseña"
        :type="showPassword ? 'text' : 'password'"
        autocomplete="current-password"
        prepend-inner-icon="mdi-lock-outline"
        :append-inner-icon="showPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
        hide-details
        @click:append-inner="showPassword = !showPassword"
      />
      <v-btn
        type="submit"
        color="primary"
        size="large"
        :loading="loading"
        :disabled="!email.trim() || !password"
      >
        Ingresar
      </v-btn>
      <NuxtLink
        to="/login"
        class="text-body-2 text-center mt-2 link"
      >
        ¿Eres comprador? Ingresa aquí
      </NuxtLink>
    </form>
  </v-container>
</template>

<style scoped>
.rules {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 4px;
  font-size: 0.85rem;
  color: var(--nt-text-muted);
}

.rules li {
  display: flex;
  align-items: center;
  gap: 6px;
}

.rules li.ok {
  color: var(--nt-success);
}

.link {
  color: var(--nt-accent);
}
</style>
