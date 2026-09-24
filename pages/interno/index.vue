<script setup lang="ts">
/** El acceso del personal ahora vive en /login (modo "Personal interno"). Se conserva la ruta por enlaces viejos. */
definePageMeta({
  middleware: [
    to => navigateTo({ path: '/login', query: to.query }, { replace: true })
  ]
})
</script>

<template>
  <div />
</template>
