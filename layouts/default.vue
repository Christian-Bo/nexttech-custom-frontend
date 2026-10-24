<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useDisplay } from 'vuetify'
import { INTERNAL_ROLES } from '~/types/auth'
import { useProfileService } from '~/features/profile/services/profileService'
import { loadPortrait } from '~/features/photo-studio/services/portraitStorage'

const auth = useAuthStore()
const cart = useCartStore()
const snackbar = useSnackbar()
const route = useRoute()
const { smAndDown } = useDisplay()
const useMocks = !!useRuntimeConfig().public.useMocks

const SHOP_NAV = [
  { to: '/catalogo', label: 'Catálogo', icon: 'mdi-storefront-outline' },
  { to: '/personalizar', label: 'Personalizar', icon: 'mdi-palette-outline' },
  { to: '/seguimiento', label: 'Seguimiento', icon: 'mdi-map-marker-path' }
]

/**
 * Menú según el rol (solo experiencia de uso: el backend valida cada acción con sus policies).
 */
const NAV = computed(() => {
  if (!auth.isInternal) return SHOP_NAV
  if (auth.hasRole(INTERNAL_ROLES.DELIVERY_DRIVER)) return [{ to: '/repartidor', label: 'Entregas', icon: 'mdi-moped-outline' }]
  const staff = [
    { to: '/panel', label: 'Dashboard', icon: 'mdi-view-dashboard-outline' },
    { to: '/panel/produccion', label: 'Producción', icon: 'mdi-hammer-wrench' }
  ]
  return auth.hasRole(INTERNAL_ROLES.ADMIN)
    ? [{ to: '/admin', label: 'Administración', icon: 'mdi-shield-account-outline' }, ...staff]
    : staff
})

/** El carrito solo aplica al comprador (o al modo demo sin sesión de personal). */
const showCart = computed(() => !auth.isInternal && (useMocks || auth.isBuyer || !auth.isAuthenticated))
const isStaff = computed(() => auth.isInternal)

const roleLabel = computed(() => {
  if (auth.hasRole(INTERNAL_ROLES.ADMIN)) return 'Administrador'
  if (auth.hasRole(INTERNAL_ROLES.SUPERVISOR)) return 'Supervisor'
  if (auth.hasRole(INTERNAL_ROLES.DELIVERY_DRIVER)) return 'Repartidor'
  return null
})

function isActive(to: string): boolean {
  return route.path === to || (to !== '/panel' && route.path.startsWith(`${to}/`))
}

async function logout(): Promise<void> {
  const wasInternal = auth.isInternal
  auth.clearSession()
  cart.reset()
  snackbar.info('Cerraste sesión.')
  await navigateTo(wasInternal ? '/login' : '/')
}

// Avatar visual: misma foto autorizada que utiliza Mi cuenta, sin tocar la sesión ni el JWT.
const avatarUrl = ref<string | null>(null)
const avatarInitials = computed(() => (auth.nickname ?? roleLabel.value ?? 'NT').slice(0, 2).toUpperCase())
let avatarObjectUrl: string | null = null
let avatarRequest = 0

async function loadAvatar(): Promise<void> {
  const request = ++avatarRequest
  if (avatarObjectUrl) URL.revokeObjectURL(avatarObjectUrl)
  avatarObjectUrl = null
  avatarUrl.value = null
  if (!auth.isBuyer) return
  avatarUrl.value = loadPortrait(auth.buyerId)?.modified ?? null
  try {
    const photo = await useProfileService().photo()
    if (request !== avatarRequest) return
    if (photo?.size && photo.type.startsWith('image/')) {
      avatarObjectUrl = URL.createObjectURL(photo)
      avatarUrl.value = avatarObjectUrl
    }
  }
  catch {
    // Si no hay retrato accesible, conservar la foto local o mostrar iniciales.
  }
}

onMounted(() => void loadAvatar())
watch(() => [auth.isBuyer, auth.buyerId], () => void loadAvatar())
watch(() => route.path, (next, previous) => {
  if (auth.isBuyer && (previous === '/mi-foto' || previous === '/mi-cuenta')) void loadAvatar()
})
onBeforeUnmount(() => {
  avatarRequest++
  if (avatarObjectUrl) URL.revokeObjectURL(avatarObjectUrl)
})

onMounted(() => void cart.load().catch(() => {}))
watch(() => auth.isBuyer, () => void cart.load().catch(() => {}))
</script>

<template>
  <v-app>
    <AppBackground />
    <v-app-bar
      color="surface"
      flat
      border="b"
      density="comfortable"
    >
      <div class="bar">
        <BrandLogo />

        <nav
          v-if="!smAndDown"
          class="bar__nav"
          aria-label="Principal"
        >
          <NuxtLink
            v-for="item in NAV"
            :key="item.to"
            :to="item.to"
            class="bar__link"
            :class="{ 'bar__link--active': isActive(item.to) }"
          >
            {{ item.label }}
          </NuxtLink>
        </nav>

        <v-spacer />

        <v-btn
          v-if="showCart"
          icon
          to="/carrito"
          aria-label="Carrito"
        >
          <v-badge
            :model-value="cart.count > 0"
            :content="cart.count"
            color="accent"
          >
            <v-icon icon="mdi-cart-outline" />
          </v-badge>
        </v-btn>

        <!-- Acceso directo: el visitante no debe abrir el menú para iniciar sesión en móvil. -->
        <v-btn
          v-if="!auth.isAuthenticated && smAndDown"
          to="/login"
          variant="text"
          size="small"
          class="bar__login text-none"
        >
          Ingresar
        </v-btn>

        <v-menu location="bottom end">
          <template #activator="{ props }">
            <v-btn
              v-if="auth.isAuthenticated"
              v-bind="props"
              variant="text"
              class="bar__account text-none ml-1"
              :aria-label="`Mi cuenta: ${auth.nickname ?? roleLabel ?? 'Usuario'}`"
            >
              <v-avatar size="34" class="bar__avatar">
                <v-img v-if="avatarUrl" :src="avatarUrl" alt="Foto de perfil" cover />
                <span v-else class="bar__avatar-initials">{{ avatarInitials }}</span>
              </v-avatar>
              <span v-if="!smAndDown" class="ml-2 bar__account-name">{{ auth.nickname ?? roleLabel ?? 'Mi cuenta' }}</span>
              <v-icon v-if="!smAndDown" icon="mdi-chevron-down" size="small" class="ml-1" />
            </v-btn>
            <v-btn
              v-else-if="smAndDown"
              v-bind="props"
              icon="mdi-menu"
              aria-label="Menú"
            />
          </template>

          <v-list
            density="comfortable"
            min-width="220"
          >
            <template v-if="smAndDown">
              <v-list-item
                v-for="item in NAV"
                :key="item.to"
                :to="item.to"
                :prepend-icon="item.icon"
                :title="item.label"
              />
              <v-divider class="my-1" />
            </template>
            <template v-if="isStaff">
              <v-list-item
                :title="auth.nickname ?? 'Personal'"
                :subtitle="roleLabel ?? undefined"
                prepend-icon="mdi-badge-account-horizontal-outline"
              />
            </template>
            <template v-else-if="auth.isAuthenticated">
              <v-list-item
                to="/mi-cuenta"
                prepend-icon="mdi-account-outline"
                title="Mi cuenta"
              />
              <v-list-item
                to="/mis-pedidos"
                prepend-icon="mdi-receipt-text-outline"
                title="Mis pedidos"
              />
              <v-list-item
                to="/mi-credencial"
                prepend-icon="mdi-card-account-details-outline"
                title="Mi credencial"
              />
              <v-list-item
                to="/mi-foto"
                prepend-icon="mdi-image-edit-outline"
                title="Mi foto de perfil"
              />
            </template>
            <template v-if="auth.isAuthenticated">
              <v-divider class="my-1" />
              <v-list-item
                prepend-icon="mdi-logout"
                title="Cerrar sesión"
                @click="logout"
              />
            </template>
            <template v-else>
              <v-list-item
                to="/login"
                prepend-icon="mdi-login"
                title="Ingresar"
              />
              <v-list-item
                to="/registro"
                prepend-icon="mdi-account-plus-outline"
                title="Crear cuenta"
              />
            </template>
          </v-list>
        </v-menu>

        <template v-if="!auth.isAuthenticated && !smAndDown">
          <v-btn
            to="/login"
            variant="text"
            class="text-none ml-1"
          >
            Ingresar
          </v-btn>
          <v-btn
            to="/registro"
            color="primary"
            variant="flat"
            class="text-none ml-1"
          >
            Crear cuenta
          </v-btn>
        </template>
      </div>
    </v-app-bar>

    <v-main class="nt-layer">
      <slot />
    </v-main>

    <!-- UI global: una sola instancia para toda la app -->
    <AppSnackbar />
    <ConfirmDialog />
  </v-app>
</template>

<style scoped>
.bar {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
  padding-inline: 16px;
}

.bar__nav {
  display: flex;
  gap: 4px;
  margin-left: 24px;
}

.bar__link {
  position: relative;
  padding: 8px 12px;
  border-radius: 8px;
  color: var(--nt-text-secondary);
  text-decoration: none;
  font-weight: 500;
  font-size: 0.95rem;
  transition: color 0.15s ease, background-color 0.15s ease;
}

.bar__link:hover {
  color: var(--nt-text);
  background-color: rgb(148 163 184 / 10%);
}

.bar__link--active {
  color: var(--nt-text);
}

.bar__link--active::after {
  content: '';
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 2px;
  height: 2px;
  border-radius: 2px;
  background: linear-gradient(90deg, var(--nt-primary), var(--nt-accent));
}

/* Avatar real o iniciales visibles incluso mientras carga la fotografía. */
.bar__avatar { background: var(--nt-surface-elevated); border: 1px solid var(--nt-border); }
.bar__avatar-initials { font-size: 0.8rem; font-weight: 800; color: var(--nt-text); }
.bar__account-name { max-width: 130px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* Barra móvil compacta: cuenta, carrito y acceso permanecen visibles. */
.bar { min-width: 0; }
.bar :deep(.v-btn) { flex-shrink: 0; }
@media (max-width: 600px) {
  .bar { gap: 3px; padding-inline: 8px; }
  .bar :deep(.v-btn--icon) { width: 40px; height: 44px; }
  .bar__login { padding-inline: 8px; min-height: 40px; font-size: 0.84rem; font-weight: 600; }
  .bar__account { min-width: 40px; padding-inline: 3px !important; }
  .bar :deep(.v-badge__badge) { font-size: 10px; }
  .bar :deep(a):focus-visible { outline-offset: 0; }
}
@media (max-width: 350px) {
  .bar { padding-inline: 4px; gap: 0; }
  .bar__login { padding-inline: 6px; }
}


@media (max-width: 380px) {
  .bar :deep(.brand) { font-size: 0.88rem; }
  .bar :deep(.brand__custom) { display: none; }
}

</style>
