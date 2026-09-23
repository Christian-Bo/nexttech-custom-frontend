<script setup lang="ts">
/**
 * Marca NextTech Custom. Extraída del layout default para reutilizarla
 * en el layout de autenticación y donde haga falta.
 */
withDefaults(defineProps<{
  to?: string
  size?: 'default' | 'large'
}>(), {
  to: '/',
  size: 'default'
})
</script>

<template>
  <NuxtLink
    :to="to"
    class="brand"
    :class="{ 'brand--large': size === 'large' }"
  >
    <span>Next</span><span class="brand__tech">Tech</span>
    <span class="brand__custom">Custom</span>
  </NuxtLink>
</template>

<style scoped>
.brand {
  color: var(--nt-text);
  text-decoration: none;
  font-weight: 700;
  letter-spacing: -0.01em;
  white-space: nowrap;
}

.brand--large {
  font-size: 1.25rem;
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