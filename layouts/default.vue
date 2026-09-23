<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useDisplay } from 'vuetify'

const auth = useAuthStore()
const cart = useCartStore()
const snackbar = useSnackbar()
const route = useRoute()
const { smAndDown } = useDisplay()
const useMocks = !!useRuntimeConfig().public.useMocks

const NAV = [
  { to: '/catalogo', label: 'Catálogo', icon: 'mdi-storefront-outline' },
  { to: '/personalizar', label: 'Personalizar', icon: 'mdi-palette-outline' },
  { to: '/seguimiento', label: 'Seguimiento', icon: 'mdi-map-marker-path' }
]

/** El carrito solo aplica al comprador (o al modo demo). */
const showCart = computed(() => useMocks || auth.isBuyer || !auth.isAuthenticated)
const isStaff = computed(() => auth.isInternal)

function isActive(to: string): boolean {
  return route.path === to || route.path.startsWith(`${to}/`)
}

async function logout(): Promise<void> {
  auth.clearSession()
  cart.reset()
  snackbar.info('Cerraste sesión.')
  await navigateTo('/')
}

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

        <v-menu location="bottom end">
          <template #activator="{ props }">
            <v-btn
              v-if="auth.isAuthenticated"
              v-bind="props"
              variant="tonal"
              class="text-none ml-1"
              :prepend-icon="smAndDown ? undefined : 'mdi-account-circle-outline'"
              :icon="smAndDown ? 'mdi-account-circle-outline' : undefined"
              :aria-label="smAndDown ? 'Mi cuenta' : undefined"
            >
              <template v-if="!smAndDown">
                {{ auth.nickname ?? 'Mi cuenta' }}
              </template>
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
                to="/panel"
                prepend-icon="mdi-view-dashboard-outline"
                title="Panel"
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
                to="/mi-foto"
                prepend-icon="mdi-card-account-details-outline"
                title="Mi foto y credencial"
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
</style>
