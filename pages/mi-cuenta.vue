<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import type { BuyerProfile, NotificationCode } from '~/features/profile/services/profileService'
import { NOTIFICATION_OPTIONS, useProfileService } from '~/features/profile/services/profileService'
import { loadPortrait } from '~/features/photo-studio/services/portraitStorage'
import { isApiError } from '~/services/api'
import type { ApiError } from '~/types/api'
import type { AccessTokenResultDto } from '~/types/auth'
import { formatDateTime } from '~/utils/format'

definePageMeta({
  middleware: [
    (to) => {
      if (useRuntimeConfig().public.useMocks) return
      if (!useAuthStore().isBuyer) return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
    }
  ]
})
useHead({ title: 'Mi cuenta · NextTech Custom' })

const auth = useAuthStore()
const cart = useCartStore()
const snackbar = useSnackbar()
const service = useProfileService()
const useMocks = !!useRuntimeConfig().public.useMocks

const profile = ref<BuyerProfile | null>(null)
const loading = ref(true)
const error = ref<ApiError | null>(null)
const photoUrl = ref<string | null>(null)
let objectUrl: string | null = null

const form = reactive({ nickname: '', phone: '', birthDate: '', notification: 'EMAIL' as NotificationCode })
const savingProfile = ref(false)

const pwd = reactive({ current: '', next: '', confirm: '' })
const showPwd = ref(false)
const savingPwd = ref(false)

const maxBirthDate = new Date().toISOString().slice(0, 10)

const rules = {
  required: (v: string) => !!v?.trim() || 'Este campo es obligatorio.',
  nickname: (v: string) => v.trim().length <= 50 || 'Máximo 50 caracteres.',
  phone: (v: string) => v.trim().length <= 25 || 'Máximo 25 caracteres.',
  password: (v: string) =>
    (v.length >= 8 && /[A-Z]/.test(v) && /[a-z]/.test(v) && /\d/.test(v))
    || 'Mínimo 8 caracteres, con mayúscula, minúscula y número.',
  same: (v: string) => v === pwd.next || 'Las contraseñas no coinciden.'
}

const dirty = computed(() => !!profile.value && (
  form.nickname.trim() !== profile.value.nickname
  || form.phone.trim() !== profile.value.phone
  || (form.birthDate || null) !== (profile.value.birthDate?.slice(0, 10) ?? null)
  || form.notification !== profile.value.notificationPreference.code
))

const pwdValid = computed(() =>
  !!pwd.current && rules.password(pwd.next) === true && pwd.next === pwd.confirm && pwd.next !== pwd.current
)

const initials = computed(() => (profile.value?.nickname ?? auth.nickname ?? '?').slice(0, 2).toUpperCase())

function fillForm(p: BuyerProfile): void {
  form.nickname = p.nickname
  form.phone = p.phone
  form.birthDate = p.birthDate?.slice(0, 10) ?? ''
  form.notification = p.notificationPreference.code
}

async function loadPhoto(): Promise<void> {
  const local = loadPortrait(auth.buyerId)?.modified ?? null
  try {
    const blob = useMocks ? null : await service.photo()
    if (blob) {
      objectUrl = URL.createObjectURL(blob)
      photoUrl.value = objectUrl
      return
    }
  }
  catch {
    // Sin foto del backend: se usa la local si existe.
  }
  photoUrl.value = local
}

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    profile.value = await service.get()
    fillForm(profile.value)
    void loadPhoto()
  }
  catch (e) {
    error.value = isApiError(e) ? e : { status: 0, code: 'UNKNOWN', message: 'No se pudo cargar tu perfil.' }
  }
  finally {
    loading.value = false
  }
}

function applyToken(token: AccessTokenResultDto): void {
  if (token.accessToken) auth.setSession(token)
}

async function saveProfile(): Promise<void> {
  if (rules.required(form.nickname) !== true || rules.required(form.phone) !== true) return
  savingProfile.value = true
  try {
    const result = await service.update({
      nickname: form.nickname,
      phone: form.phone,
      birthDate: form.birthDate || null,
      notificationPreferenceCode: form.notification
    })
    profile.value = result.profile
    fillForm(result.profile)
    applyToken(result.refreshedToken)
    snackbar.success('Tus datos se guardaron.')
  }
  catch (e) {
    snackbar.error(isApiError(e) ? e : 'No se pudieron guardar tus datos.')
  }
  finally {
    savingProfile.value = false
  }
}

async function changePassword(): Promise<void> {
  if (!pwdValid.value) return
  savingPwd.value = true
  try {
    const result = await service.changePassword(pwd.current, pwd.next)
    applyToken(result.refreshedToken)
    pwd.current = ''
    pwd.next = ''
    pwd.confirm = ''
    snackbar.success('Tu contraseña se cambió.')
  }
  catch (e) {
    snackbar.error(isApiError(e) ? e : 'No se pudo cambiar la contraseña.')
  }
  finally {
    savingPwd.value = false
  }
}

async function logout(): Promise<void> {
  auth.clearSession()
  cart.reset()
  snackbar.info('Cerraste sesión.')
  await navigateTo('/login')
}

onMounted(load)
onBeforeUnmount(() => {
  if (objectUrl) URL.revokeObjectURL(objectUrl)
})
</script>

<template>
  <v-container
    class="py-8"
    style="max-width: 1000px"
  >
    <v-skeleton-loader
      v-if="loading"
      type="card-avatar, article"
    />

    <StateError
      v-else-if="error"
      :error="error"
      @retry="load"
    />

    <template v-else-if="profile">
      <!-- Encabezado -->
      <header class="hero">
        <div class="hero__photo">
          <img
            v-if="photoUrl"
            :src="photoUrl"
            alt="Tu foto"
          >
          <span v-else>{{ initials }}</span>
        </div>
        <div class="hero__info">
          <h1 class="text-h4 font-weight-bold">
            {{ profile.nickname }}
          </h1>
          <div class="text-medium-emphasis">
            {{ profile.email }}
          </div>
          <div class="d-flex flex-wrap ga-2 mt-3">
            <v-chip
              size="small"
              color="accent"
              variant="tonal"
              prepend-icon="mdi-account-check-outline"
            >
              {{ profile.role.name }}
            </v-chip>
            <v-chip
              v-if="profile.lastAccessUtc"
              size="small"
              variant="tonal"
              prepend-icon="mdi-clock-outline"
            >
              Último acceso {{ formatDateTime(profile.lastAccessUtc) }}
            </v-chip>
          </div>
        </div>
        <div class="hero__actions">
          <v-btn
            to="/mis-pedidos"
            variant="tonal"
            class="text-none"
            prepend-icon="mdi-receipt-text-outline"
          >
            Mis pedidos
          </v-btn>
          <v-btn
            to="/mi-foto"
            color="primary"
            class="text-none"
            prepend-icon="mdi-card-account-details-outline"
          >
            Foto y credencial
          </v-btn>
        </div>
      </header>

      <div class="grid">
        <!-- Datos personales -->
        <section class="panel">
          <h2 class="panel__title">
            <v-icon
              icon="mdi-account-edit-outline"
              size="20"
            /> Datos personales
          </h2>
          <v-form @submit.prevent="saveProfile">
            <v-text-field
              :model-value="profile.email"
              label="Correo electrónico"
              variant="outlined"
              prepend-inner-icon="mdi-email-outline"
              readonly
              hint="El correo no se puede cambiar."
              persistent-hint
              class="mb-3"
            />
            <v-text-field
              v-model="form.nickname"
              label="Nickname"
              variant="outlined"
              prepend-inner-icon="mdi-at"
              :rules="[rules.required, rules.nickname]"
              :disabled="savingProfile"
            />
            <v-text-field
              v-model="form.phone"
              label="Teléfono"
              type="tel"
              variant="outlined"
              prepend-inner-icon="mdi-phone-outline"
              :rules="[rules.required, rules.phone]"
              :disabled="savingProfile"
            />
            <v-text-field
              v-model="form.birthDate"
              label="Fecha de nacimiento (opcional)"
              type="date"
              variant="outlined"
              prepend-inner-icon="mdi-cake-variant-outline"
              :max="maxBirthDate"
              :disabled="savingProfile"
            />
            <v-select
              v-model="form.notification"
              :items="NOTIFICATION_OPTIONS"
              item-title="name"
              item-value="code"
              label="¿Cómo te avisamos de tus pedidos?"
              variant="outlined"
              prepend-inner-icon="mdi-bell-outline"
              :disabled="savingProfile"
            />
            <v-btn
              type="submit"
              color="primary"
              class="text-none"
              :disabled="!dirty"
              :loading="savingProfile"
              block
            >
              Guardar cambios
            </v-btn>
          </v-form>
        </section>

        <!-- Seguridad -->
        <section class="panel">
          <h2 class="panel__title">
            <v-icon
              icon="mdi-shield-lock-outline"
              size="20"
            /> Contraseña
          </h2>
          <v-form @submit.prevent="changePassword">
            <v-text-field
              v-model="pwd.current"
              label="Contraseña actual"
              :type="showPwd ? 'text' : 'password'"
              variant="outlined"
              autocomplete="current-password"
              prepend-inner-icon="mdi-lock-outline"
              :disabled="savingPwd"
            />
            <v-text-field
              v-model="pwd.next"
              label="Nueva contraseña"
              :type="showPwd ? 'text' : 'password'"
              variant="outlined"
              autocomplete="new-password"
              prepend-inner-icon="mdi-lock-reset"
              :append-inner-icon="showPwd ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
              :rules="[rules.password]"
              :disabled="savingPwd"
              @click:append-inner="showPwd = !showPwd"
            />
            <v-text-field
              v-model="pwd.confirm"
              label="Confirmar nueva contraseña"
              :type="showPwd ? 'text' : 'password'"
              variant="outlined"
              autocomplete="new-password"
              prepend-inner-icon="mdi-lock-check-outline"
              :rules="[rules.same]"
              :disabled="savingPwd"
            />
            <v-btn
              type="submit"
              variant="tonal"
              class="text-none"
              :disabled="!pwdValid"
              :loading="savingPwd"
              block
            >
              Cambiar contraseña
            </v-btn>
          </v-form>

          <v-divider class="my-6" />

          <h2 class="panel__title">
            <v-icon
              icon="mdi-face-recognition"
              size="20"
            /> Acceso con rostro y QR
          </h2>
          <p class="text-body-2 text-medium-emphasis mb-4">
            Registra tu rostro para ingresar sin contraseña. Tu credencial trae un código QR para ingresar y recibir tus pedidos.
          </p>
          <FaceEnrollCard v-if="!useMocks" />
          <v-alert
            v-else
            type="info"
            variant="tonal"
            density="compact"
          >
            El registro de rostro necesita el backend (modo demo activo).
          </v-alert>

          <v-btn
            variant="text"
            color="error"
            class="text-none mt-6"
            prepend-icon="mdi-logout"
            block
            @click="logout"
          >
            Cerrar sesión
          </v-btn>
        </section>
      </div>
    </template>
  </v-container>
</template>

<style scoped>
.hero {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 24px;
  padding: 24px;
  margin-bottom: 24px;
  border-radius: 20px;
  border: 1px solid rgb(148 163 184 / 25%);
  background:
    radial-gradient(circle at 0% 0%, rgb(37 99 235 / 30%), transparent 55%),
    rgb(30 41 59 / 90%);
}

.hero__photo {
  display: grid;
  place-items: center;
  width: 96px;
  height: 128px;
  border-radius: 16px;
  overflow: hidden;
  font-size: 2rem;
  font-weight: 800;
  color: #0f172a;
  background: linear-gradient(135deg, #06b6d4, #2563eb);
  box-shadow: 0 0 0 3px rgb(6 182 212 / 60%);
}

.hero__photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.hero__info {
  flex: 1 1 240px;
}

.hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24px;
  align-items: start;
}

.panel {
  padding: 24px;
  border-radius: 16px;
  border: 1px solid rgb(148 163 184 / 25%);
  background: rgb(30 41 59 / 90%);
}

.panel__title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.05rem;
  font-weight: 700;
  margin-bottom: 16px;
}

@media (max-width: 860px) {
  .grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
