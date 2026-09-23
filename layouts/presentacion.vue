<template>
  <v-app>
    <AppBackground intensity="full" />
    <v-main class="nt-layer">
      <slot />
    </v-main>
    <AppSnackbar />
  </v-app>
</template>
