<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useAuthService } from '~/services/authService'
import { useInternalAuthService } from '~/services/internalAuthService'
import { isApiError } from '~/services/api'
import type { AccessTokenResultDto } from '~/types/auth'
import { ACTOR_TYPES } from '~/types/auth'
import { homeFor, redirectFitsActor, safeRedirect } from '~/utils/authRedirect'

/**
 * Login único para compradores y personal (decisión del equipo):
 * 1. Se intenta como comprador      -> POST /api/auth/login          (usuario o correo + contraseña)
 * 2. Si responde 401 y se escribió un correo, se intenta como personal -> POST /api/internal/auth/login
 * Luego se redirige según actorType/rol (homeFor). Si fallan los dos se muestra un único mensaje genérico.
 */
definePageMeta({ layout: 'auth' })
useHead({ title: 'Iniciar sesión | NextTech Custom' })

const route = useRoute()
const auth = useAuthStore()
const cart = useCartStore()
const authService = useAuthService()
const internalService = useInternalAuthService()
const snackbar = useSnackbar()

const identifier = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)
const errorMessage = ref('')

/** Personal con contraseña temporal: se muestra el paso de cambio obligatorio. */
const changeStep = ref<{ email: string, password: string } | null>(null)
const altMethod = ref<'qr' | 'face' | null>(null)

onMounted(() => {
  if (auth.isAuthenticated && !auth.mustChangePassword) void navigateTo(homeFor(auth.actorType, auth.role))
})

const rules = {
  required: (value: string) => !!value?.trim() || 'Este campo es obligatorio.'
}

/** Destino tras iniciar sesión: el redirect pendiente si corresponde a ese tipo de cuenta, o su inicio. */
async function goHome(): Promise<void> {
  const redirect = safeRedirect(route.query.redirect)
  const target = redirect && redirectFitsActor(redirect, auth.actorType) ? redirect : homeFor(auth.actorType, auth.role)
  await navigateTo(target)
}

async function finishBuyer(result: AccessTokenResultDto): Promise<void> {
  if (result.actorType !== ACTOR_TYPES.BUYER) {
    errorMessage.value = 'Esta cuenta no es de comprador.'
    return
  }
  auth.setSession(result)
  void cart.load().catch(() => {})
  snackbar.success(`¡Hola${auth.nickname ? `, ${auth.nickname}` : ''}!`)
  await goHome()
}

async function finishInternal(result: AccessTokenResultDto): Promise<void> {
  if (result.actorType !== ACTOR_TYPES.INTERNAL) {
    errorMessage.value = 'Esta cuenta no pertenece al personal.'
    return
  }
  auth.setSession(result)
  if (result.mustChangePassword) {
    changeStep.value = { email: identifier.value.trim(), password: password.value }
    return
  }
  password.value = ''
  await goHome()
}

function loginError(error: unknown): string {
  const status = isApiError(error) ? error.status : 0
  if (status === 401) return 'Usuario o contraseña incorrectos.'
  if (status === 403 || status === 423) return 'Tu cuenta está bloqueada o inactiva. Inténtalo más tarde o contacta a soporte.'
  if (status === 429) return 'Demasiados intentos. Espera un momento e inténtalo de nuevo.'
  return isApiError(error) ? error.message : 'No se pudo iniciar sesión.'
}

async function iniciarSesion(): Promise<void> {
  errorMessage.value = ''
  const id = identifier.value.trim()
  if (!id || !password.value) {
    errorMessage.value = 'Ingresa tu usuario y tu contraseña.'
    return
  }

  loading.value = true
  try {
    try {
      await finishBuyer(await authService.login({ identifier: id, password: password.value }))
      return
    }
    catch (buyerError) {
      // Solo un 401 con correo pasa al acceso del personal; bloqueos (403/423) o 429 se muestran tal cual.
      const retryAsStaff = isApiError(buyerError) && buyerError.status === 401 && id.includes('@')
      if (!retryAsStaff) throw buyerError
    }
    await finishInternal(await internalService.login({ email: id, password: password.value }))
  }
  catch (error) {
    errorMessage.value = loginError(error)
  }
  finally {
    loading.value = false
  }
}

async function onPasswordChanged(result: AccessTokenResultDto): Promise<void> {
  changeStep.value = null
  password.value = ''
  auth.setSession(result)
  snackbar.success('Contraseña actualizada.')
  await goHome()
}

function cancelChange(): void {
  changeStep.value = null
  password.value = ''
  auth.clearSession()
}

async function onAltLogin(result: AccessTokenResultDto): Promise<void> {
  altMethod.value = null
  await finishBuyer(result)
}

/* ----- Recuperación de contraseña (comprador) ----- */
const resetOpen = ref(false)
const resetEmail = ref('')
const resetLoading = ref(false)
const resetDone = ref(false)

async function enviarRecuperacion() {
  if (!resetEmail.value.trim()) return

  resetLoading.value = true
  try {
    await authService.forgotPassword({ email: resetEmail.value.trim() })
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
    <!-- Paso: cambio obligatorio de contraseña (personal interno) -->
    <template v-if="changeStep">
      <h1 class="text-h4 font-weight-bold mb-2">
        Crea tu nueva contraseña
      </h1>
      <p class="text-medium-emphasis mb-6">
        {{ changeStep.email }}
      </p>
      <InternalPasswordChange
        :email="changeStep.email"
        :current-password="changeStep.password"
        @done="onPasswordChanged"
        @cancel="cancelChange"
      />
    </template>

    <template v-else>
      <h1 class="text-h4 font-weight-bold mb-2">
        Inicia sesión
      </h1>
      <p class="text-medium-emphasis mb-6">
        Entra con tu usuario o tu correo. Te llevamos a tu tienda o a tu panel según tu cuenta.
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
          type="text"
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

      <!-- Otros accesos (solo compradores) -->
      <div class="divider my-6">
        <span>o ingresa con</span>
      </div>
      <div class="d-flex ga-3">
        <v-btn
          variant="outlined"
          class="text-none flex-1-1"
          prepend-icon="mdi-qrcode-scan"
          @click="altMethod = 'qr'"
        >
          Mi QR
        </v-btn>
        <v-btn
          variant="outlined"
          class="text-none flex-1-1"
          prepend-icon="mdi-face-recognition"
          @click="altMethod = 'face'"
        >
          Mi rostro
        </v-btn>
      </div>

      <p class="text-center mt-8">
        ¿No tienes cuenta?
        <NuxtLink to="/registro">Créala aquí</NuxtLink>
      </p>
    </template>

    <!-- Login con QR o rostro (solo comprador) -->
    <v-dialog
      :model-value="altMethod !== null"
      max-width="520"
      @update:model-value="(v: boolean) => { if (!v) altMethod = null }"
    >
      <v-card
        rounded="lg"
        border
        class="pa-4"
      >
        <QrLoginCard
          v-if="altMethod === 'qr'"
          @success="onAltLogin"
        />
        <FaceLoginCard
          v-else-if="altMethod === 'face'"
          @success="onAltLogin"
        />
        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            class="text-none"
            @click="altMethod = null"
          >
            Cerrar
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

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
          <p class="text-caption text-medium-emphasis mb-4">
            Si eres del personal de NextTech, pide a un administrador que restablezca tu contraseña.
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

<style scoped>
.divider {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--nt-text-muted);
  font-size: 0.85rem;
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: rgb(148 163 184 / 30%);
}
</style>
