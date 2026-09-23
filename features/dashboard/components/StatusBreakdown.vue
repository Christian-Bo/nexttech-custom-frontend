<script setup lang="ts">
import { computed } from 'vue'
import type { StatusCountDto } from '../types/dashboard'

/**
 * Pedidos por estado: barras horizontales de un solo tono.
 * La identidad la da la etiqueta (chip con ícono), no el color de la barra.
 */
const props = defineProps<{ estados: StatusCountDto[] }>()

const total = computed(() => props.estados.reduce((s, e) => s + e.cantidad, 0))
const max = computed(() => Math.max(1, ...props.estados.map(e => e.cantidad)))
</script>

<template>
  <div
    v-if="total === 0"
    class="text-body-2 text-medium-emphasis py-6 text-center"
  >
    Sin pedidos en este período.
  </div>
  <ul
    v-else
    class="rows"
  >
    <li
      v-for="e in estados"
      :key="e.estado"
      class="row"
    >
      <StatusChip
        :status="e.estado"
        size="x-small"
        class="row__chip"
      />
      <div
        class="row__track"
        role="presentation"
      >
        <div
          class="row__fill"
          :style="{ width: `${(e.cantidad / max) * 100}%` }"
        />
      </div>
      <span class="row__value">{{ e.cantidad }}</span>
      <span class="row__pct">{{ total ? Math.round(e.cantidad / total * 100) : 0 }}%</span>
    </li>
  </ul>
</template>

<style scoped>
.rows {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.row {
  display: grid;
  grid-template-columns: 170px minmax(0, 1fr) 32px 40px;
  align-items: center;
  gap: 10px;
}

.row__chip {
  justify-self: start;
}

.row__track {
  height: 10px;
  border-radius: 999px;
  background: var(--nt-chart-track);
  overflow: hidden;
}

.row__fill {
  height: 100%;
  border-radius: 999px;
  background: var(--nt-chart-1);
  transition: width 500ms ease;
}

.row__value {
  text-align: right;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.row__pct {
  text-align: right;
  font-size: 0.8rem;
  color: var(--nt-text-muted);
  font-variant-numeric: tabular-nums;
}

@media (max-width: 480px) {
  .row {
    grid-template-columns: 140px minmax(0, 1fr) 28px;
  }

  .row__pct {
    display: none;
  }
}
</style>
