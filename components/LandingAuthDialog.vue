<script setup lang="ts">
import { useDisplay } from 'vuetify'
import { useAuthService } from '~/services/authService'
import { useInternalAuthService } from '~/services/internalAuthService'
import { homeFor, safeRedirect, redirectFitsActor } from '~/utils/authRedirect'
import { isApiError } from '~/services/api'
import { GT_COUNTRY_PREFIX, GT_PHONE_DIGITS, gtPhoneRule, sanitizeGtInput, toBackendPhone } from '~/utils/phone'
import type { AccessTokenResultDto } from '~/types/auth'
import { ACTOR_TYPES } from '~/types/auth'

const props = defineProps<{ modelValue: boolean, initialMode?: 'login' | 'register' }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
const { xs } = useDisplay()
const auth = useAuthStore()
const cart = useCartStore()
const snackbar = useSnackbar()
const authService = useAuthService()
const internalService = useInternalAuthService()
const route = useRoute()
const changeStep = ref<{ email: string, password: string } | null>(null)
const mode = ref<'login' | 'register'>('login')
const loading = ref(false)
const errorMessage = ref('')
const identifier = ref('')
const password = ref('')
const showPassword = ref(false)
const altMethod = ref<'face' | 'qr' | null>(null)
const quickFaceRef = ref<{ cancelPending: () => void } | null>(null)
const resetOpen = ref(false)
const resetEmail = ref('')
const resetLoading = ref(false)
const resetDone = ref(false)
const registration = reactive({
  email: '', phone: '', nickname: '', password: '', passwordConfirm: '', birthDate: '',
  notifyByEmail: true, notifyByWhatsApp: false
})
const phoneLocal = computed({
  get: () => registration.phone,
  set: (v: string) => { registration.phone = sanitizeGtInput(v) }
})
watch(() => props.modelValue, (open) => {
  if (open) { mode.value = props.initialMode ?? 'login'; errorMessage.value = '' }
  else { closeAlternative(); changeStep.value = null }
})
watch(() => props.initialMode, value => { if (props.modelValue && value) setMode(value) })
function setMode(next: 'login' | 'register') { mode.value = next; errorMessage.value = '' }
function closeAlternative() { quickFaceRef.value?.cancelPending(); altMethod.value = null }
function close() { if (!loading.value) { closeAlternative(); if (changeStep.value) { auth.clearSession(); changeStep.value = null; password.value = '' }; emit('update:modelValue', false) } }
async function goHome() {
  const redirect = safeRedirect(route.query.redirect)
  const target = redirect && redirectFitsActor(redirect, auth.actorType)
    ? redirect
    : homeFor(auth.actorType, auth.role)
  emit('update:modelValue', false)
  await navigateTo(target)
}
async function finishBuyer(result: AccessTokenResultDto) {
  if (result.actorType !== ACTOR_TYPES.BUYER) throw new Error('Tipo de cuenta inesperado.')
  auth.setSession(result)
  void cart.load().catch(() => {})
  snackbar.success('¡Bienvenido a NextTech Custom!')
  await goHome()
}
async function finishInternal(result: AccessTokenResultDto) {
  if (result.actorType !== ACTOR_TYPES.INTERNAL) throw new Error('Tipo de cuenta inesperado.')
  auth.setSession(result)
  if (result.mustChangePassword) {
    changeStep.value = { email: identifier.value.trim(), password: password.value }
    return
  }
  snackbar.success('Sesión iniciada correctamente.')
  await goHome()
}
async function onPasswordChanged(result: AccessTokenResultDto) {
  changeStep.value = null
  password.value = ''
  auth.setSession(result)
  snackbar.success('Contraseña actualizada.')
  await goHome()
}
function cancelChange() {
  changeStep.value = null
  password.value = ''
  auth.clearSession()
}
function errorFor(error: unknown): string {
  if (!isApiError(error)) return 'No se pudo completar la operación.'
  if (error.status === 401) return 'Usuario o contraseña incorrectos.'
  if (error.status === 403 || error.status === 423) return 'Cuenta bloqueada o inactiva. Contacta a soporte.'
  if (error.status === 429) return 'Demasiados intentos. Intenta más tarde.'
  return error.message
}
async function login() {
  errorMessage.value = ''
  const id = identifier.value.trim()
  if (!id || !password.value) { errorMessage.value = 'Ingresa tu usuario y contraseña.'; return }
  loading.value = true
  try {
    try {
      await finishBuyer(await authService.login({ identifier: id, password: password.value }))
      return
    } catch (buyerError) {
      // Mismo contrato del login original: probar personal solo tras un 401 y con correo.
      const retryAsStaff = isApiError(buyerError) && buyerError.status === 401 && id.includes('@')
      if (!retryAsStaff) throw buyerError
    }
    await finishInternal(await internalService.login({ email: id, password: password.value }))
  } catch (error) {
    errorMessage.value = errorFor(error)
  } finally {
    loading.value = false
    if (!changeStep.value) password.value = ''
  }
}
async function register() {
  errorMessage.value = ''
  if (!registration.email.trim() || !registration.nickname.trim() || !registration.phone || !registration.password) {
    errorMessage.value = 'Completa los campos obligatorios.'; return
  }
  if (!registration.email.includes('@') || registration.email.trim().length > 150 || registration.nickname.trim().length > 50) {
    errorMessage.value = 'Revisa tu correo y nickname.'; return
  }
  if (gtPhoneRule(registration.phone) !== true) { errorMessage.value = 'Introduce un teléfono válido de 8 dígitos.'; return }
  if (registration.password.length < 8 || registration.password.length > 128 || !/[A-Z]/.test(registration.password) || !/[a-z]/.test(registration.password) || !/\d/.test(registration.password)) {
    errorMessage.value = 'Usa 8 a 128 caracteres, mayúscula, minúscula y número.'; return
  }
  if (registration.password !== registration.passwordConfirm) { errorMessage.value = 'Las contraseñas no coinciden.'; return }
  if (!registration.notifyByEmail && !registration.notifyByWhatsApp) { errorMessage.value = 'Elige al menos un canal de notificación.'; return }
  loading.value = true
  try {
    const result = await authService.register({
      email: registration.email.trim(), phone: toBackendPhone(registration.phone),
      nickname: registration.nickname.trim(), password: registration.password,
      birthDate: registration.birthDate || null,
      notifyByEmail: registration.notifyByEmail, notifyByWhatsApp: registration.notifyByWhatsApp
    })
    auth.setSession(result.token)
    emit('update:modelValue', false)
    snackbar.success('¡Cuenta creada! Completa tu credencial.')
    await navigateTo('/mi-credencial?nuevo=1')
  }
  catch (error) { errorMessage.value = errorFor(error) }
  finally { loading.value = false; registration.password = ''; registration.passwordConfirm = '' }
}
async function onAlternativeLogin(result: AccessTokenResultDto) {
  closeAlternative()
  await finishBuyer(result)
}
async function resetPassword() {
  if (!resetEmail.value.trim()) return
  resetLoading.value = true
  try { await authService.forgotPassword({ email: resetEmail.value.trim() }); resetDone.value = true }
  catch (error) { if (isApiError(error) && error.status === 0) snackbar.error(error); else resetDone.value = true }
  finally { resetLoading.value = false }
}
</script>

<template>
  <v-dialog :model-value="modelValue" max-width="530" scrollable :fullscreen="xs" @update:model-value="value => { if (!value) close() }">
    <v-card class="landing-auth" rounded="xl" border>
      <div class="landing-auth__top">
        <div><span class="landing-auth__eyebrow">NEXTTECH CUSTOM</span><h2>{{ changeStep ? 'Actualiza tu contraseña' : mode === 'login' ? 'Bienvenido de nuevo' : 'Únete a NextTech' }}</h2></div>
        <v-btn icon="mdi-close" variant="text" aria-label="Cerrar acceso" :disabled="loading" @click="close" />
      </div>
      <v-card-text class="landing-auth__body">
        <v-btn-toggle v-if="!changeStep" :model-value="mode" mandatory divided rounded="lg" color="primary" class="landing-auth__toggle mb-5" @update:model-value="setMode">
          <v-btn value="login" class="text-none flex-grow-1">Ingresar</v-btn>
          <v-btn value="register" class="text-none flex-grow-1">Crear cuenta</v-btn>
        </v-btn-toggle>
        <div v-if="changeStep">
          <p class="text-body-2 text-medium-emphasis mb-4">{{ changeStep.email }}</p>
          <InternalPasswordChange :email="changeStep.email" :current-password="changeStep.password" @done="onPasswordChanged" @cancel="cancelChange" />
        </div>
        <Transition v-else name="auth-slide" mode="out-in">
          <v-form v-if="mode === 'login'" key="login" @submit.prevent="login">
            <p class="text-body-2 text-medium-emphasis mb-4">Ingresa con tus credenciales para continuar.</p>
            <v-text-field v-model="identifier" label="Usuario o correo" autocomplete="username" prepend-inner-icon="mdi-account-outline" variant="outlined" color="accent" :disabled="loading" />
            <v-text-field v-model="password" label="Contraseña" autocomplete="current-password" prepend-inner-icon="mdi-lock-outline" variant="outlined" color="accent" :type="showPassword ? 'text' : 'password'" :append-inner-icon="showPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'" :disabled="loading" @click:append-inner="showPassword = !showPassword" />
            <div class="d-flex justify-end mb-3"><v-btn size="small" variant="text" class="text-none" @click="resetOpen = true">Olvidé mi contraseña</v-btn></div>
            <v-alert v-if="errorMessage" type="error" variant="tonal" density="compact" class="mb-3">{{ errorMessage }}</v-alert>
            <v-btn type="submit" color="primary" size="large" variant="flat" block class="text-none" :loading="loading">Ingresar <v-icon end icon="mdi-arrow-right" /></v-btn>
            <div class="landing-auth__separator my-4">o ingresa con</div>
            <div class="d-flex ga-2 flex-wrap">
              <v-btn class="text-none flex-grow-1" variant="outlined" prepend-icon="mdi-face-recognition" @click="altMethod = 'face'">Mi rostro</v-btn>
              <v-btn class="text-none flex-grow-1" variant="outlined" prepend-icon="mdi-qrcode-scan" @click="altMethod = 'qr'">Mi QR</v-btn>
            </div>

          </v-form>
          <v-form v-else key="register" @submit.prevent="register">
            <p class="text-body-2 text-medium-emphasis mb-4">Una cuenta para diseñar, comprar y seguir tus llaveros.</p>
            <v-text-field v-model="registration.email" label="Correo electrónico" type="email" autocomplete="email" prepend-inner-icon="mdi-email-outline" variant="outlined" color="accent" :disabled="loading" />
            <v-text-field v-model="registration.nickname" label="Nickname" autocomplete="username" prepend-inner-icon="mdi-account-outline" variant="outlined" color="accent" :disabled="loading" />
            <v-text-field v-model="phoneLocal" label="Teléfono" type="tel" inputmode="numeric" autocomplete="tel-national" :prefix="GT_COUNTRY_PREFIX" :maxlength="GT_PHONE_DIGITS" prepend-inner-icon="mdi-phone-outline" variant="outlined" color="accent" :disabled="loading" />
            <v-text-field v-model="registration.password" label="Contraseña" autocomplete="new-password" prepend-inner-icon="mdi-lock-outline" variant="outlined" color="accent" :type="showPassword ? 'text' : 'password'" hint="8 caracteres mínimo, mayúscula, minúscula y número" persistent-hint :disabled="loading" :append-inner-icon="showPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'" @click:append-inner="showPassword = !showPassword" />
            <v-text-field v-model="registration.passwordConfirm" label="Confirmar contraseña" autocomplete="new-password" variant="outlined" color="accent" :type="showPassword ? 'text' : 'password'" :disabled="loading" />
            <v-expansion-panels variant="accordion" class="mb-4"><v-expansion-panel title="Información opcional"><v-expansion-panel-text><v-text-field v-model="registration.birthDate" label="Fecha de nacimiento" type="date" variant="outlined" color="accent" :max="new Date().toISOString().slice(0,10)" /></v-expansion-panel-text></v-expansion-panel></v-expansion-panels>
            <p class="text-caption text-medium-emphasis mb-1">Recibir avisos por:</p>
            <div class="d-flex flex-wrap ga-3 mb-3"><v-checkbox v-model="registration.notifyByEmail" label="Correo" color="accent" density="compact" hide-details /><v-checkbox v-model="registration.notifyByWhatsApp" label="WhatsApp" color="accent" density="compact" hide-details /></div>
            <v-alert v-if="errorMessage" type="error" variant="tonal" density="compact" class="mb-3">{{ errorMessage }}</v-alert>
            <v-btn type="submit" color="primary" variant="flat" size="large" block class="text-none" :loading="loading">Crear mi cuenta <v-icon end icon="mdi-arrow-right" /></v-btn>
          </v-form>
        </Transition>
      </v-card-text>
    </v-card>
  </v-dialog>
  <v-dialog :model-value="altMethod !== null" max-width="520" @update:model-value="value => { if (!value) closeAlternative() }">
    <v-card rounded="lg" class="pa-4">
      <FaceQuickLoginCard v-if="altMethod === 'face'" ref="quickFaceRef" @success="onAlternativeLogin" />
      <QrLoginCard v-else-if="altMethod === 'qr'" @success="onAlternativeLogin" />
      <v-card-actions><v-spacer /><v-btn variant="text" class="text-none" @click="closeAlternative">Cerrar</v-btn></v-card-actions>
    </v-card>
  </v-dialog>
  <v-dialog v-model="resetOpen" max-width="460">
    <v-card rounded="lg"><v-card-title>Recuperar contraseña</v-card-title><v-card-text>
      <p v-if="resetDone" class="mb-3">Si ese correo tiene una cuenta, recibirás un enlace de recuperación.</p>
      <template v-else><p class="text-body-2 mb-3">Te enviaremos un enlace a tu correo registrado.</p><v-text-field v-model="resetEmail" type="email" label="Correo" variant="outlined" @keyup.enter="resetPassword" /></template>
    </v-card-text><v-card-actions><v-spacer /><v-btn variant="text" @click="resetOpen = false; resetDone = false">Cerrar</v-btn><v-btn v-if="!resetDone" color="primary" :loading="resetLoading" @click="resetPassword">Enviar enlace</v-btn></v-card-actions></v-card>
  </v-dialog>
</template>

<style scoped>
.landing-auth { background: var(--nt-surface, #1e293b); color: var(--nt-text, #fff); }
.landing-auth__top { display:flex; align-items:center; justify-content:space-between; padding:24px 24px 0; gap:12px; }
.landing-auth__top h2 { font-size:clamp(1.25rem,4vw,1.7rem); font-weight:800; }
.landing-auth__eyebrow { font-size:.72rem; letter-spacing:.15em; color:var(--nt-accent, #22d3ee); font-weight:800; }
.landing-auth__body { padding:20px 24px 24px; overflow-x:hidden; }
.landing-auth__toggle { width:100%; display:flex; }
.landing-auth__separator { text-align:center; color:var(--nt-text-secondary, #a1a1aa); font-size:.82rem; }
.auth-slide-enter-active,.auth-slide-leave-active { transition: opacity .18s ease, transform .18s ease; }
.auth-slide-enter-from { opacity:0; transform:translateX(16px); }
.auth-slide-leave-to { opacity:0; transform:translateX(-16px); }
@media (prefers-reduced-motion:reduce) { .auth-slide-enter-active,.auth-slide-leave-active { transition:none; } }
@media(max-width:599px) { .landing-auth__top { padding:16px 16px 0; } .landing-auth__body { padding:16px; } }
</style>
