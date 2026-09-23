<script setup lang="ts">
import { computed } from 'vue'
import type { ProductSalesDto } from '../types/dashboard'
import { formatQ } from '~/utils/format'

/** Ventas por tipo de producto: barras horizontales de un solo tono, ordenadas por monto. */
const props = defineProps<{ productos: ProductSalesDto[] }>()

const max = computed(() => Math.max(1, ...props.productos.map(p => p.total)))
</script>

<template>
  <div
    v-if="productos.length === 0"
    class="text-body-2 text-medium-emphasis py-6 text-center"
  >
    Sin ventas en este período.
  </div>
  <ul
    v-else
    class="rows"
  >
    <li
      v-for="p in productos"
      :key="p.producto"
      class="row"
    >
      <div class="row__head">
        <span class="row__name">{{ p.producto }}</span>
        <span class="row__value">{{ formatQ(p.total) }}</span>
      </div>
      <div class="row__line">
        <div
          class="row__track"
          role="presentation"
        >
          <div
            class="row__fill"
            :style="{ width: `${(p.total / max) * 100}%` }"
          />
        </div>
        <span class="row__units">{{ p.unidades }} u.</span>
      </div>
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
  gap: 14px;
}

.row__head {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 0.875rem;
  margin-bottom: 4px;
}

.row__name {
  color: var(--nt-text);
}

.row__value {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.row__line {
  display: flex;
  align-items: center;
  gap: 10px;
}

.row__track {
  flex: 1;
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

.row__units {
  min-width: 40px;
  text-align: right;
  font-size: 0.78rem;
  color: var(--nt-text-muted);
  font-variant-numeric: tabular-nums;
}
</style>
