<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { SalesPointDto } from '../types/dashboard'
import { formatDayShort, formatQ, formatTime } from '~/utils/format'

/**
 * Columnas de ventas (serie única -> sin leyenda; el título la nombra).
 * Marcas: <=24px, extremo redondeado 4px, base recta. Grid hairline.
 * Tooltip por columna (mouse y teclado) + vista de tabla.
 */
const props = defineProps<{
  points: SalesPointDto[]
  /** 'hour' cuando el rango es hoy. */
  granularity: 'hour' | 'day'
}>()

const HEIGHT = 240
const PAD = { top: 24, right: 8, bottom: 28, left: 56 }

const wrap = ref<HTMLDivElement | null>(null)
const width = ref(600)
const hover = ref<number | null>(null)
const showTable = ref(false)
let ro: ResizeObserver | null = null

const innerW = computed(() => Math.max(10, width.value - PAD.left - PAD.right))
const innerH = HEIGHT - PAD.top - PAD.bottom

/** Máximo "redondo" para ticks limpios. */
const niceMax = computed(() => {
  const max = Math.max(...props.points.map(p => p.total), 0)
  if (max <= 0) return 100
  const step = Math.pow(10, Math.floor(Math.log10(max)))
  const nice = [1, 2, 2.5, 5, 10].map(m => m * step).find(v => v >= max)!
  return nice
})

const ticks = computed(() => [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(niceMax.value * f)))
const band = computed(() => innerW.value / Math.max(1, props.points.length))
const barW = computed(() => Math.min(24, band.value * 0.6))
const maxIndex = computed(() => {
  let idx = -1
  let best = 0
  props.points.forEach((p, i) => {
    if (p.total > best) {
      best = p.total
      idx = i
    }
  })
  return idx
})

function y(v: number): number {
  return PAD.top + innerH - (v / niceMax.value) * innerH
}

function barPath(i: number): string {
  const p = props.points[i]!
  const h = Math.max(0, (p.total / niceMax.value) * innerH)
  if (h === 0) return ''
  const x = PAD.left + band.value * i + (band.value - barW.value) / 2
  const top = PAD.top + innerH - h
  const r = Math.min(4, h, barW.value / 2)
  const w = barW.value
  const base = PAD.top + innerH
  return `M${x},${base} L${x},${top + r} Q${x},${top} ${x + r},${top} L${x + w - r},${top} Q${x + w},${top} ${x + w},${top + r} L${x + w},${base} Z`
}

function label(p: SalesPointDto): string {
  return props.granularity === 'hour' ? formatTime(p.fecha) : formatDayShort(p.fecha)
}

/** Muestra una etiqueta del eje X cada N columnas para no amontonar. */
const labelEvery = computed(() => Math.max(1, Math.ceil(props.points.length / Math.max(1, Math.floor(innerW.value / 56)))))

const tooltip = computed(() => {
  if (hover.value === null) return null
  const p = props.points[hover.value]
  if (!p) return null
  const x = PAD.left + band.value * hover.value + band.value / 2
  return { p, left: Math.min(Math.max(x, 70), width.value - 70), top: y(p.total) }
})

onMounted(() => {
  ro = new ResizeObserver(() => {
    if (wrap.value) width.value = wrap.value.clientWidth
  })
  if (wrap.value) {
    width.value = wrap.value.clientWidth
    ro.observe(wrap.value)
  }
})
onBeforeUnmount(() => ro?.disconnect())
</script>

<template>
  <div>
    <div class="d-flex justify-end mb-1">
      <v-btn
        size="x-small"
        variant="text"
        :prepend-icon="showTable ? 'mdi-chart-bar' : 'mdi-table'"
        @click="showTable = !showTable"
      >
        {{ showTable ? 'Ver gráfico' : 'Ver como tabla' }}
      </v-btn>
    </div>

    <v-table
      v-if="showTable"
      density="compact"
      class="chart-table"
    >
      <thead>
        <tr>
          <th>{{ granularity === 'hour' ? 'Hora' : 'Día' }}</th>
          <th class="text-right">
            Pedidos
          </th>
          <th class="text-right">
            Ventas
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="p in points"
          :key="p.fecha"
        >
          <td>{{ label(p) }}</td>
          <td class="text-right num">
            {{ p.pedidos }}
          </td>
          <td class="text-right num">
            {{ formatQ(p.total) }}
          </td>
        </tr>
      </tbody>
    </v-table>

    <div
      v-show="!showTable"
      ref="wrap"
      class="chart"
      @mouseleave="hover = null"
    >
      <svg
        :width="width"
        :height="HEIGHT"
        role="img"
        :aria-label="`Ventas por ${granularity === 'hour' ? 'hora' : 'día'}`"
      >
        <!-- Grid + eje Y -->
        <g>
          <template
            v-for="t in ticks"
            :key="t"
          >
            <line
              :x1="PAD.left"
              :x2="width - PAD.right"
              :y1="y(t)"
              :y2="y(t)"
              class="grid"
            />
            <text
              :x="PAD.left - 8"
              :y="y(t) + 4"
              text-anchor="end"
              class="axis"
            >Q{{ t.toLocaleString('es-GT') }}</text>
          </template>
        </g>

        <!-- Columnas -->
        <g>
          <path
            v-for="(p, i) in points"
            :key="p.fecha"
            :d="barPath(i)"
            class="bar"
            :class="{ 'bar--dim': hover !== null && hover !== i }"
          />
        </g>

        <!-- Etiqueta del máximo -->
        <text
          v-if="maxIndex >= 0 && hover === null"
          :x="PAD.left + band * maxIndex + band / 2"
          :y="y(points[maxIndex]!.total) - 8"
          text-anchor="middle"
          class="value"
        >{{ formatQ(points[maxIndex]!.total) }}</text>

        <!-- Eje X -->
        <g>
          <template
            v-for="(p, i) in points"
            :key="`x-${p.fecha}`"
          >
            <text
              v-if="i % labelEvery === 0"
              :x="PAD.left + band * i + band / 2"
              :y="HEIGHT - 8"
              text-anchor="middle"
              class="axis"
            >{{ label(p) }}</text>
          </template>
        </g>

        <!-- Zonas de hover/foco (más grandes que la marca) -->
        <g>
          <rect
            v-for="(p, i) in points"
            :key="`hit-${p.fecha}`"
            :x="PAD.left + band * i"
            :y="PAD.top"
            :width="band"
            :height="innerH"
            fill="transparent"
            tabindex="0"
            :aria-label="`${label(p)}: ${formatQ(p.total)}, ${p.pedidos} pedidos`"
            class="hit"
            @mouseenter="hover = i"
            @focus="hover = i"
            @blur="hover = null"
          />
        </g>
      </svg>

      <div
        v-if="tooltip"
        class="tip"
        :style="{ left: `${tooltip.left}px`, top: `${tooltip.top}px` }"
        role="tooltip"
      >
        <div class="tip__title">
          {{ label(tooltip.p) }}
        </div>
        <div class="tip__row">
          <span class="tip__key" />Ventas <strong>{{ formatQ(tooltip.p.total) }}</strong>
        </div>
        <div class="tip__row tip__row--muted">
          {{ tooltip.p.pedidos }} pedido{{ tooltip.p.pedidos === 1 ? '' : 's' }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chart {
  position: relative;
  width: 100%;
}

.grid {
  stroke: var(--nt-border);
  stroke-opacity: 0.45;
  stroke-width: 1;
}

.axis {
  fill: var(--nt-text-muted);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.value {
  fill: var(--nt-text-secondary);
  font-size: 11px;
  font-weight: 600;
}

.bar {
  fill: var(--nt-chart-1);
  transition: opacity var(--nt-transition-fast), d 400ms ease;
}

.bar--dim {
  opacity: 0.45;
}

.hit {
  cursor: crosshair;
  outline: none;
}

.hit:focus-visible {
  stroke: var(--nt-accent);
  stroke-width: 2;
}

.tip {
  position: absolute;
  transform: translate(-50%, calc(-100% - 12px));
  min-width: 130px;
  padding: 8px 10px;
  background: var(--nt-surface-elevated);
  border: 1px solid var(--nt-border);
  border-radius: var(--nt-radius-sm);
  box-shadow: 0 8px 20px rgb(0 0 0 / 35%);
  pointer-events: none;
  font-size: 0.8rem;
  white-space: nowrap;
}

.tip__title {
  font-weight: 600;
  margin-bottom: 2px;
}

.tip__row {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--nt-text);
}

.tip__row--muted {
  color: var(--nt-text-muted);
}

.tip__key {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  background: var(--nt-chart-1);
}

.num {
  font-variant-numeric: tabular-nums;
}

.chart-table {
  background: transparent !important;
}
</style>
