<script setup lang="ts">
useHead({ title: 'NextTech Custom | Productos personalizados en el campus' })

const auth = useAuthStore()

/** Botón principal: invita a registrarse solo a quien no ha iniciado sesión. */
const primaryCta = computed(() => {
  if (!auth.isAuthenticated) {
    return { text: 'Crear mi cuenta', to: '/registro', icon: undefined }
  }
  if (auth.isInternal) {
    return { text: 'Ir a mi panel', to: homeFor(auth.actorType, auth.role), icon: 'mdi-view-dashboard-outline' }
  }
  return { text: 'Personalizar ahora', to: '/personalizar', icon: 'mdi-palette-outline' }
})

/** Lado del producto que se muestra en la portada. */
const side = ref<'A' | 'B'>('A')

/** Secuencia real del flujo, por eso va numerada. */
const steps = [
  {
    title: 'Crea tu cuenta',
    text: 'Tómate una foto, ponle filtros y recibe tu credencial con código QR.'
  },
  {
    title: 'Personaliza los dos lados',
    text: 'Pon una foto en el Lado A y un mensaje en el Lado B. Ves el resultado antes de pagar.'
  },
  {
    title: 'Recíbelo en el campus',
    text: 'Sigue tu pedido en tiempo real y recógelo en el punto de entrega que elijas.'
  }
]

/** Catálogo del MVP definido en la propuesta del equipo. */
const products = [
  {
    name: 'Llavero acrílico',
    text: 'Rectangular, con foto, texto o stickers en cada lado.',
    icon: 'mdi-key-chain-variant'
  },
  {
    name: 'Photocard',
    text: 'Tarjeta con diseño al frente y mensaje al reverso.',
    icon: 'mdi-card-account-details-star-outline'
  },
  {
    name: 'Imán fotográfico',
    text: 'Tu imagen con texto y marco decorativo.',
    icon: 'mdi-magnet'
  }
]
</script>

<template>
  <div>
    <!-- Portada -->
    <section class="hero">
      <v-container class="hero__grid">
        <div>
          <h1 class="hero__title">
            Diseña tu llavero por los dos lados.
          </h1>
          <p class="hero__lead">
            Llaveros, photocards e imanes con tu foto y tu mensaje.
            Paga en efectivo al recibirlo dentro del campus.
          </p>

          <div class="d-flex flex-wrap ga-3 mt-8">
            <v-btn
              color="primary"
              size="x-large"
              variant="flat"
              class="text-none"
              :to="primaryCta.to"
              :prepend-icon="primaryCta.icon"
            >
              {{ primaryCta.text }}
            </v-btn>
            <v-btn
              size="x-large"
              variant="outlined"
              class="text-none"
              to="/catalogo"
              prepend-icon="mdi-storefront-outline"
            >
              Ver catálogo
            </v-btn>
          </div>
        </div>

        <!-- Producto de ejemplo: gira entre Lado A y Lado B -->
        <div class="hero__product">
          <div
            class="keychain"
            :class="{ 'keychain--flipped': side === 'B' }"
          >
            <div
              class="keychain__face keychain__face--a"
              :aria-hidden="side !== 'A'"
            >
              <span class="keychain__hole" />
              <v-icon
                icon="mdi-account-circle"
                size="104"
              />
              <span class="keychain__caption">Tu foto con filtros</span>
            </div>

            <div
              class="keychain__face keychain__face--b"
              :aria-hidden="side !== 'B'"
            >
              <span class="keychain__hole" />
              <span class="keychain__message">Promo 2027</span>
              <span class="keychain__caption">Tu mensaje</span>
            </div>
          </div>

          <v-btn-toggle
            v-model="side"
            mandatory
            variant="outlined"
            color="accent"
            density="comfortable"
            rounded="lg"
            class="mt-6"
            aria-label="Elegir qué lado del producto ver"
          >
            <v-btn
              value="A"
              class="text-none"
            >
              Lado A
            </v-btn>
            <v-btn
              value="B"
              class="text-none"
            >
              Lado B
            </v-btn>
          </v-btn-toggle>
        </div>
      </v-container>
    </section>

    <!-- Cómo funciona -->
    <section class="section">
      <v-container class="section__container">
        <h2 class="section__title">
          Así funciona
        </h2>

        <ol class="steps">
          <li
            v-for="(step, i) in steps"
            :key="step.title"
          >
            <span
              class="steps__number"
              aria-hidden="true"
            >{{ i + 1 }}</span>
            <h3 class="steps__title">
              {{ step.title }}
            </h3>
            <p class="steps__text">
              {{ step.text }}
            </p>
          </li>
        </ol>
      </v-container>
    </section>

    <!-- Productos -->
    <section class="section section--last">
      <v-container class="section__container">
        <h2 class="section__title">
          Qué puedes personalizar
        </h2>

        <v-row>
          <v-col
            v-for="product in products"
            :key="product.name"
            cols="12"
            md="4"
          >
            <v-card
              class="pa-6 h-100"
              variant="flat"
              border
              rounded="lg"
            >
              <v-icon
                :icon="product.icon"
                size="36"
                class="product__icon"
              />
              <h3 class="text-h6 font-weight-semibold mt-4">
                {{ product.name }}
              </h3>
              <p class="text-body-2 text-medium-emphasis mt-2">
                {{ product.text }}
              </p>
            </v-card>
          </v-col>
        </v-row>
      </v-container>
    </section>
  </div>
</template>

<style scoped>
/* ---------- Portada ---------- */
.hero {
  border-bottom: 1px solid var(--nt-border);
}

.hero__grid {
  display: grid;
  gap: 3rem;
  align-items: center;
  max-width: 1200px;
  padding-block: 3.5rem 4rem;
}

.hero__title {
  max-width: 12ch;
  font-size: clamp(2.5rem, 6.5vw, 4.5rem);
  font-weight: 800;
  line-height: 1.05;
  letter-spacing: -0.03em;
}

.hero__lead {
  max-width: 46ch;
  margin-top: 1.25rem;
  font-size: 1.125rem;
  line-height: 1.6;
  color: var(--nt-text-secondary);
}

.hero__product {
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* ---------- Producto que gira ---------- */
.keychain {
  position: relative;
  width: min(250px, 68vw);
  aspect-ratio: 3 / 4;
  transform-style: preserve-3d;
  transition: transform var(--nt-transition-base);
  transition-duration: 700ms;
}

.keychain--flipped {
  transform: rotateY(180deg);
}

.keychain__face {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.875rem;
  border-radius: 24px 24px 32px 32px;
  backface-visibility: hidden;
  box-shadow: 0 28px 56px -28px rgb(0 0 0 / 80%);
}

.keychain__face--a {
  background-color: var(--nt-primary);
  color: var(--nt-text);
}

.keychain__face--b {
  background-color: var(--nt-surface-elevated);
  border: 1px solid var(--nt-border);
  transform: rotateY(180deg);
}

.keychain__hole {
  position: absolute;
  top: 1rem;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background-color: var(--nt-bg);
}

.keychain__message {
  font-size: 2rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.keychain__caption {
  font-size: 0.9rem;
  font-weight: 600;
  opacity: 0.85;
}

/* ---------- Secciones ---------- */
.section {
  padding-block: 4rem;
}

.section--last {
  padding-top: 0;
}

.section__container {
  max-width: 1200px;
}

.section__title {
  margin-bottom: 2rem;
  font-size: clamp(1.75rem, 4vw, 2.25rem);
  font-weight: 800;
  letter-spacing: -0.02em;
}

/* ---------- Pasos ---------- */
.steps {
  display: grid;
  gap: 2rem;
  padding: 0;
  list-style: none;
}

.steps__number {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border: 2px solid var(--nt-primary);
  border-radius: 50%;
  font-size: 1.1rem;
  font-weight: 800;
}

.steps__title {
  margin-top: 1rem;
  font-size: 1.25rem;
  font-weight: 700;
}

.steps__text {
  max-width: 34ch;
  margin-top: 0.5rem;
  line-height: 1.6;
  color: var(--nt-text-secondary);
}

.product__icon {
  color: var(--nt-text-muted);
}

@media (min-width: 960px) {
  .hero__grid {
    grid-template-columns: 7fr 5fr;
    padding-block: 5.5rem 6rem;
  }

  .steps {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>