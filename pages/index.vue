<!--
  Página TEMPORAL: solo verifica que el theme NextTech carga bien.
  La reemplaza Integrante 4 con el home/catálogo real.
-->
<script setup lang="ts">
const palette = [
  { name: 'Fondo', token: '--nt-bg', hex: '#0F172A' },
  { name: 'Superficie', token: '--nt-surface', hex: '#1E293B' },
  { name: 'Elevado', token: '--nt-surface-elevated', hex: '#334155' },
  { name: 'Principal', token: '--nt-primary', hex: '#2563EB' },
  { name: 'Acento', token: '--nt-accent', hex: '#06B6D4' },
  { name: 'Éxito', token: '--nt-success', hex: '#22C55E' },
  { name: 'Advertencia', token: '--nt-warning', hex: '#F59E0B' },
  { name: 'Error', token: '--nt-error', hex: '#EF4444' }
]
</script>

<template>
  <v-container class="py-10">
    <h1 class="text-h4 font-weight-bold mb-2">
      NextTech Custom
    </h1>
    <p class="text-medium-emphasis mb-8">
      Tema base cargado. Esta página es temporal.
    </p>

    <v-row>
      <v-col
        v-for="c in palette"
        :key="c.token"
        cols="6"
        sm="4"
        md="3"
      >
        <v-card
          variant="flat"
          border
        >
          <div
            class="swatch"
            :style="{ background: `var(${c.token})` }"
          />
          <v-card-text>
            <div class="font-weight-medium">
              {{ c.name }}
            </div>
            <code class="text-caption text-medium-emphasis">{{ c.hex }}</code>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <div class="d-flex flex-wrap ga-3 mt-8">
      <v-btn color="primary">
        Principal
      </v-btn>
      <v-btn
        color="accent"
        variant="tonal"
      >
        Acento
      </v-btn>
      <v-btn variant="outlined">
        Secundario
      </v-btn>
      <v-chip color="success">
        Entregado
      </v-chip>
      <v-chip color="warning">
        En elaboración
      </v-chip>
      <v-chip color="error">
        Comprador no encontrado
      </v-chip>
    </div>
  </v-container>
</template>

<style scoped>
.swatch {
  height: 72px;
  border-bottom: 1px solid var(--nt-border);
}
</style>
