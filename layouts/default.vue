<template>
  <v-app>
    <v-app-bar
      color="surface"
      flat
      border="b"
      density="comfortable"
    >
      <v-app-bar-title>
        <NuxtLink
          to="/"
          class="brand"
        >
          <span class="brand__next">Next</span><span class="brand__tech">Tech</span>
          <span class="brand__custom">Custom</span>
        </NuxtLink>
      </v-app-bar-title>
    </v-app-bar>

    <v-main>
      <slot />
    </v-main>
  </v-app>
</template>

<style scoped>
.brand {
  color: var(--nt-text);
  text-decoration: none;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.brand__tech {
  color: var(--nt-accent);
}

.brand__custom {
  margin-left: 0.4rem;
  color: var(--nt-text-muted);
  font-weight: 500;
}
</style>
