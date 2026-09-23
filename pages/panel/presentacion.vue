<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { DashboardRange, DashboardSummaryDto } from '~/features/dashboard/types/dashboard'
import { useDashboardService } from '~/features/dashboard/services/dashboardService'
import StatusBreakdown from '~/features/dashboard/components/StatusBreakdown.vue'
import ProductBreakdown from '~/features/dashboard/components/ProductBreakdown.vue'
import { formatQ } from '~/utils/format'

/**
 * Dashboard en modo presentación (enunciado 5.c): pantalla completa, cifras grandes,
 * día / semana / total a la vez y actualización automática.
 */
definePageMeta({ layout: 'presentacion', middleware: 'staff' })
useHead({ title: 'Dashboard en vivo · NextTech Custom' })

const service = useDashboardService()
const realtime = useRealtime()

const RANGES: { value: DashboardRange, label: string }[] = [
  { value: 'day', label: 'Hoy' },
  { value: 'week', label: 'Esta semana' },
  { value: 'total', label: 'Total' }
]

const data = ref<Partial<Record<DashboardRange, DashboardSummaryDto>>>({})
const failed = ref(false)
const flashing = ref<Set<string>>(new Set())
const now = ref(new Date())
const isFullscreen = ref(false)
const root = ref<HTMLElement | null>(null)

const detail = computed(() => data.value.day ?? null)
const clock = computed(() => now.value.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
const dateLabel = computed(() => now.value.toLocaleDateString('es-GT', { weekday: 'long', day: 'numeric', month: 'long' }))

async function load(): Promise<void> {
  const results = await Promise.allSettled(RANGES.map(r => service.getSummary(r.value)))
  const changed = new Set<string>()
  const next = { ...data.value }
  results.forEach((res, i) => {
    const range = RANGES[i]!.value
    if (res.status !== 'fulfilled') return
    const prev = data.value[range]
    if (prev && (prev.kpis.ventas !== res.value.kpis.ventas || prev.kpis.pedidos !== res.value.kpis.pedidos)) changed.add(range)
    next[range] = res.value
  })
  failed.value = results.every(r => r.status === 'rejected')
  data.value = next
  if (changed.size) {
    flashing.value = changed
    setTimeout(() => (flashing.value = new Set()), 1500)
  }
}

async function toggleFullscreen(): Promise<void> {
  try {
    if (document.fullscreenElement) await document.exitFullscreen()
    else await (root.value ?? document.documentElement).requestFullscreen()
  }
  catch {
    // Algunos navegadores bloquean la pantalla completa; la vista sigue funcionando.
  }
}

function onFullscreenChange(): void {
  isFullscreen.value = !!document.fullscreenElement
}

realtime.on('OrderStatusChanged', () => void load())
realtime.on('OrderCreated', () => void load())
realtime.every(5_000, load)

let clockTimer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  void load()
  clockTimer = setInterval(() => (now.value = new Date()), 1000)
  document.addEventListener('fullscreenchange', onFullscreenChange)
})
onBeforeUnmount(() => {
  if (clockTimer) clearInterval(clockTimer)
  document.removeEventListener('fullscreenchange', onFullscreenChange)
})
</script>

<template>
  <div
    ref="root"
    class="show"
  >
    <header class="show__header">
      <div class="show__brand">
        <span>Next</span><span class="text-accent">Tech</span> <span class="show__custom">Custom</span>
        <span class="show__live">
          <span class="show__dot" /> EN VIVO
        </span>
      </div>
      <div class="show__clock">
        <div class="show__time">
          {{ clock }}
        </div>
        <div class="show__date">
          {{ dateLabel }}
        </div>
      </div>
      <div class="d-flex ga-2">
        <v-btn
          :icon="isFullscreen ? 'mdi-fullscreen-exit' : 'mdi-fullscreen'"
          variant="tonal"
          :aria-label="isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'"
          @click="toggleFullscreen"
        />
        <v-btn
          icon="mdi-close"
          variant="text"
          to="/panel"
          aria-label="Volver al dashboard"
        />
      </div>
    </header>

    <v-alert
      v-if="failed"
      type="warning"
      variant="tonal"
      class="mb-6"
    >
      No se pudieron actualizar los datos. Reintentando automáticamente…
    </v-alert>

    <!-- Día / semana / total -->
    <section class="show__ranges">
      <article
        v-for="r in RANGES"
        :key="r.value"
        class="show__card"
        :class="{ 'show__card--flash': flashing.has(r.value), 'show__card--main': r.value === 'day' }"
      >
        <div class="show__label">
          {{ r.label }}
        </div>
        <template v-if="data[r.value]">
          <div class="show__money">
            {{ formatQ(data[r.value]!.kpis.ventas) }}
          </div>
          <div class="show__sub">
            <span><strong>{{ data[r.value]!.kpis.pedidos.toLocaleString('es-GT') }}</strong> pedidos</span>
            <span><strong>{{ data[r.value]!.kpis.entregados.toLocaleString('es-GT') }}</strong> entregados</span>
          </div>
        </template>
        <v-skeleton-loader
          v-else
          type="heading, text"
          color="transparent"
        />
      </article>
    </section>

    <!-- Detalle de hoy -->
    <section
      v-if="detail"
      class="show__detail"
    >
      <div class="show__panel">
        <h2 class="show__title">
          Pedidos por estado <span class="text-medium-emphasis">· hoy</span>
        </h2>
        <StatusBreakdown :estados="detail.estados" />
      </div>
      <div class="show__panel">
        <h2 class="show__title">
          Ventas por producto <span class="text-medium-emphasis">· hoy</span>
        </h2>
        <ProductBreakdown :productos="detail.productos" />
      </div>
      <div class="show__panel show__panel--kpis">
        <div>
          <div class="show__label">
            En producción
          </div>
          <div class="show__big">
            {{ detail.kpis.enProduccion }}
          </div>
        </div>
        <div>
          <div class="show__label">
            Ticket promedio
          </div>
          <div class="show__big">
            {{ formatQ(detail.kpis.ticketPromedio) }}
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.show {
  min-height: 100vh;
  padding: clamp(16px, 3vw, 40px);
  display: flex;
  flex-direction: column;
  gap: clamp(16px, 2vw, 28px);
}

.show__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.show__brand {
  font-size: clamp(1.4rem, 2.4vw, 2.2rem);
  font-weight: 800;
  letter-spacing: -0.02em;
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.show__custom {
  font-weight: 400;
  opacity: 0.8;
  margin-left: 6px;
}

.show__live {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: 16px;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: #22c55e;
}

.show__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #22c55e;
  animation: pulse 1.6s ease-in-out infinite;
}

.show__clock {
  text-align: center;
}

.show__time {
  font-size: clamp(1.4rem, 2.6vw, 2.4rem);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.show__date {
  font-size: 0.85rem;
  opacity: 0.7;
  text-transform: capitalize;
}

.show__ranges {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: clamp(12px, 2vw, 24px);
}

.show__card {
  background: var(--nt-surface, #1e293b);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 18px;
  padding: clamp(16px, 2.2vw, 32px);
  transition: box-shadow 0.4s ease, border-color 0.4s ease;
}

.show__card--main {
  border-color: rgba(37, 99, 235, 0.7);
}

.show__card--flash {
  border-color: #06b6d4;
  box-shadow: 0 0 0 3px rgba(6, 182, 212, 0.35);
}

.show__label {
  font-size: clamp(0.8rem, 1.1vw, 1rem);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  opacity: 0.7;
  font-weight: 600;
}

.show__money {
  font-size: clamp(2rem, 4.4vw, 4rem);
  font-weight: 800;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  margin: 6px 0;
}

.show__sub {
  display: flex;
  gap: 18px;
  flex-wrap: wrap;
  font-size: clamp(0.9rem, 1.3vw, 1.2rem);
  opacity: 0.85;
}

.show__detail {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1.2fr) minmax(0, 0.8fr);
  gap: clamp(12px, 2vw, 24px);
  flex: 1;
}

.show__panel {
  background: var(--nt-surface, #1e293b);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 18px;
  padding: clamp(16px, 2vw, 28px);
}

.show__panel--kpis {
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  gap: 24px;
}

.show__title {
  font-size: clamp(1rem, 1.4vw, 1.3rem);
  font-weight: 700;
  margin-bottom: 16px;
}

.show__big {
  font-size: clamp(2rem, 4vw, 3.6rem);
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: #06b6d4;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.8); }
}

@media (prefers-reduced-motion: reduce) {
  .show__dot { animation: none; }
}

@media (max-width: 1100px) {
  .show__detail {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }

  .show__panel--kpis {
    grid-column: 1 / -1;
    flex-direction: row;
  }
}

@media (max-width: 760px) {
  .show__ranges,
  .show__detail {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
