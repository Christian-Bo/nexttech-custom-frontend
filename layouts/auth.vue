<template>
  <v-app>
    <v-main class="auth">
      <!-- Panel de marca: en móvil queda arriba, en escritorio a la izquierda -->
      <aside class="auth__brand">
        <BrandLogo size="large" />

        <div class="auth__pitch">
          <p class="auth__title">
            Diseña tu llavero por los dos lados.
          </p>
          <p class="auth__text">
            Una sola cuenta para comprar, seguir tu pedido y recibirlo dentro del campus.
          </p>
        </div>
      </aside>

      <section class="auth__panel">
        <div class="auth__content">
          <slot />
        </div>
      </section>

      <!-- UI global: también en este layout -->
      <AppSnackbar />
      <ConfirmDialog />
    </v-main>
  </v-app>
</template>

<style scoped>
.auth {
  display: grid;
  min-height: 100vh;
  grid-template-columns: 1fr;
}

.auth__brand {
  padding: 1.25rem 1.5rem;
  background-color: var(--nt-surface);
  border-bottom: 1px solid var(--nt-border);
}

.auth__pitch {
  display: none;
}

.auth__panel {
  display: flex;
  justify-content: center;
  padding: 2rem 1.25rem 3rem;
}

.auth__content {
  width: 100%;
  max-width: 420px;
}

@media (min-width: 960px) {
  .auth {
    grid-template-columns: 5fr 7fr;
  }

  .auth__brand {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 2.5rem 3rem;
    border-right: 1px solid var(--nt-border);
    border-bottom: none;
  }

  .auth__pitch {
    display: block;
  }

  .auth__title {
    max-width: 14ch;
    font-size: clamp(2rem, 3.2vw, 2.75rem);
    font-weight: 800;
    line-height: 1.1;
    letter-spacing: -0.02em;
  }

  .auth__text {
    max-width: 36ch;
    margin-top: 1rem;
    line-height: 1.6;
    color: var(--nt-text-secondary);
  }

  .auth__panel {
    align-items: center;
  }
}
</style>