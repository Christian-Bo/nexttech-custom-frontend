<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { ApiError } from '~/types/api'
import type { DashboardRange, DashboardSummaryDto } from '~/features/dashboard/types/dashboard'
import { useDashboardService } from '~/features/dashboard/services/dashboardService'
import KpiTile from '~/features/dashboard/components/KpiTile.vue'
import SalesColumnChart from '~/features/dashboard/components/SalesColumnChart.vue'
import StatusBreakdown from '~/features/dashboard/components/StatusBreakdown.vue'
import RecentOrdersTable from '~/features/dashboard/components/RecentOrdersTable.vue'
import { isApiError } from '~/services/api'
import { formatQ, formatQCompact, formatTime } from '~/utils/format'
import { INTERNAL_ROLES } from '~/types/auth'

// Solo ADMIN / SUPERVISOR (en modo simulado se permite para la demo).
definePageMeta({
  middleware: [
    (to) => {
      if (useRuntimeConfig().public.useMocks) return
      const auth = useAuthStore()
      if (!auth.isAuthenticated) return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
      if (!auth.hasRole(INTERNAL_ROLES.ADMIN, INTERNAL_ROLES.SUPERVISOR)) return navigateTo('/')
    }
  ]
})
useHead({ title: 'Dashboard · NextTech Custom' })

const service = useDashboardService()
const realtime = useRealtime()

const range = ref<DashboardRange>('7d')
const data = ref<DashboardSummaryDto | null>(null)
const loading = ref(true)
const error = ref<ApiError | null>(null)
const updatedAt = ref<string | null>(null)
const flashing = ref<Set<string>>(new Set())
const newOrders = ref<Set<number>>(new Set())

const RANGES: { value: DashboardRange, label: string }[] = [
  { value: 'today', label: 'Hoy' },
  { value: '7d', label: '7 días' },
  { value: '14d', label: '14 días' }
]

const kpis = computed(() => data.value?.kpis)
const isEmpty = computed(() => !!data.value && data.value.kpis.pedidos === 0)

async function load(silent = false): Promise<void> {
  if (!silent) loading.value = true
  error.value = null
  try {
    const next = await service.getSummary(range.value)
    if (silent && data.value) markChanges(data.value, next)
    data.value = next
    updatedAt.value = new Date().toISOString()
  }
  catch (e) {
    if (!silent) error.value = isApiError(e) ? e : { status: 0, code: 'UNKNOWN', message: 'No se pudo cargar el dashboard.' }
  }
  finally {
    loading.value = false
  }
}

/** Destella los KPIs que cambiaron en vivo. */
function markChanges(prev: DashboardSummaryDto, next: DashboardSummaryDto): void {
  const changed = new Set<string>()
  for (const k of ['ventas', 'pedidos', 'ticketPromedio', 'enProduccion', 'entregados'] as const) {
    if (prev.kpis[k] !== next.kpis[k]) changed.add(k)
  }
  flashing.value = changed
  setTimeout(() => (flashing.value = new Set()), 1300)
}

// Tiempo real: refresco con "debounce" para agrupar ráfagas de eventos.
let timer: ReturnType<typeof setTimeout> | null = null
function scheduleRefresh(): void {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => void load(true), 500)
}

realtime.on('OrderStatusChanged', scheduleRefresh)
realtime.on('OrderCreated', (e) => {
  newOrders.value = new Set([...newOrders.value, e.idOrden])
  setTimeout(() => {
    const s = new Set(newOrders.value)
    s.delete(e.idOrden)
    newOrders.value = s
  }, 2500)
  scheduleRefresh()
})

watch(range, () => void load())
onMounted(() => void load())
</script>

<template>
  <v-container
    fluid
    class="py-6 px-4 px-md-8"
    style="max-width: 1400px"
  >
    <!-- Encabezado + filtros (una sola fila) -->
    <div class="d-flex flex-wrap align-center ga-3 mb-6">
      <div>
        <h1 class="text-h5 font-weight-bold">
          Dashboard
        </h1>
        <div class="text-caption text-medium-emphasis">
          {{ updatedAt ? `Actualizado ${formatTime(updatedAt)}` : 'Resumen de ventas y pedidos' }}
        </div>
      </div>
      <RealtimeIndicator />
      <v-spacer />
      <v-btn-toggle
        v-model="range"
        mandatory
        density="compact"
        variant="outlined"
        color="primary"
      >
        <v-btn
          v-for="r in RANGES"
          :key="r.value"
          :value="r.value"
        >
          {{ r.label }}
        </v-btn>
      </v-btn-toggle>
    </div>

    <!-- Carga -->
    <template v-if="loading && !data">
      <div class="kpis mb-6">
        <v-skeleton-loader
          v-for="i in 5"
          :key="i"
          type="article"
          height="118"
        />
      </div>
      <v-skeleton-loader
        type="image"
        height="300"
      />
    </template>

    <StateError
      v-else-if="error"
      :error="error"
      @retry="load()"
    />

    <template v-else-if="data && kpis">
      <!-- KPIs -->
      <div class="kpis mb-6">
        <KpiTile
          label="Ventas"
          icon="mdi-cash-multiple"
          :value="formatQCompact(kpis.ventas)"
          :delta="kpis.deltaVentasPct"
          hint="vs período anterior"
          :flash="flashing.has('ventas')"
        />
        <KpiTile
          label="Pedidos"
          icon="mdi-receipt-text-outline"
          :value="kpis.pedidos.toLocaleString('es-GT')"
          :flash="flashing.has('pedidos')"
        />
        <KpiTile
          label="Ticket promedio"
          icon="mdi-scale-balance"
          :value="formatQ(kpis.ticketPromedio)"
          :flash="flashing.has('ticketPromedio')"
        />
        <KpiTile
          label="En producción"
          icon="mdi-hammer-wrench"
          :value="kpis.enProduccion.toLocaleString('es-GT')"
          hint="ahora"
          :flash="flashing.has('enProduccion')"
        />
        <KpiTile
          label="Entregados"
          icon="mdi-check-decagram"
          :value="kpis.entregados.toLocaleString('es-GT')"
          :flash="flashing.has('entregados')"
        />
      </div>

      <StateEmpty
        v-if="isEmpty"
        icon="mdi-chart-box-outline"
        title="Sin pedidos en este período"
        description="Prueba con un rango de fechas más amplio."
      />

      <template v-else>
        <div class="charts mb-6">
          <v-card
            border
            variant="flat"
            class="pa-5"
          >
            <h2 class="text-subtitle-1 font-weight-bold">
              Ventas por {{ range === 'today' ? 'hora' : 'día' }}
            </h2>
            <SalesColumnChart
              :points="data.ventas"
              :granularity="range === 'today' ? 'hour' : 'day'"
            />
          </v-card>
          <v-card
            border
            variant="flat"
            class="pa-5"
          >
            <h2 class="text-subtitle-1 font-weight-bold mb-4">
              Pedidos por estado
            </h2>
            <StatusBreakdown :estados="data.estados" />
          </v-card>
        </div>

        <v-card
          border
          variant="flat"
          class="pa-5"
        >
          <h2 class="text-subtitle-1 font-weight-bold mb-2">
            Últimos pedidos
          </h2>
          <RecentOrdersTable
            :orders="data.ultimos"
            :highlight="newOrders"
          />
        </v-card>
      </template>
    </template>
  </v-container>
</template>

<style scoped>
.kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 14px;
}

.charts {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
  gap: 20px;
}

@media (max-width: 960px) {
  .charts {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
