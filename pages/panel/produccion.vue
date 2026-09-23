<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { ApiError } from '~/types/api'
import type { ProductionOrderDto } from '~/features/production/types/production'
import { useProductionService } from '~/features/production/services/productionService'
import { isApiError } from '~/services/api'
import { formatQ, formatTime } from '~/utils/format'

/**
 * Cola de producción (SUPERVISOR / ADMIN).
 * Enunciado 3.n: la elaboración debe tomar como máximo 60 s desde que se genera la orden.
 */
definePageMeta({ middleware: 'staff' })
useHead({ title: 'Producción · NextTech Custom' })

const ELABORATION_LIMIT_S = 60

const service = useProductionService()
const realtime = useRealtime()
const snackbar = useSnackbar()

const inProduction = ref<ProductionOrderDto[]>([])
const ready = ref<ProductionOrderDto[]>([])
const loading = ref(true)
const error = ref<ApiError | null>(null)
const marking = ref<Set<string>>(new Set())
const now = ref(Date.now())
let clock: ReturnType<typeof setInterval> | null = null

const overdue = computed(() => inProduction.value.filter(o => elapsed(o) > ELABORATION_LIMIT_S).length)

function elapsed(o: ProductionOrderDto): number {
  return Math.max(0, Math.round((now.value - Date.parse(o.fechaCreacion)) / 1000))
}

function elapsedLabel(o: ProductionOrderDto): string {
  const s = elapsed(o)
  if (s < 60) return `${s} s`
  const m = Math.floor(s / 60)
  return m < 60 ? `${m} min ${s % 60} s` : `${Math.floor(m / 60)} h ${m % 60} min`
}

async function load(silent = false): Promise<void> {
  if (!silent) loading.value = true
  error.value = null
  try {
    const [a, b] = await Promise.all([service.listInProduction(), service.listReady()])
    inProduction.value = a
    ready.value = b
  }
  catch (e) {
    if (!silent) error.value = isApiError(e) ? e : { status: 0, code: 'UNKNOWN', message: 'No se pudo cargar la producción.' }
  }
  finally {
    loading.value = false
  }
}

async function markReady(o: ProductionOrderDto): Promise<void> {
  marking.value = new Set([...marking.value, o.codigoOrden])
  try {
    await service.markReady(o.codigoOrden)
    snackbar.success(`#${o.codigoOrden} listo para entrega (${elapsedLabel(o)})`)
    await load(true)
  }
  catch (e) {
    snackbar.error(isApiError(e) ? e : 'No se pudo marcar como listo.')
  }
  finally {
    const s = new Set(marking.value)
    s.delete(o.codigoOrden)
    marking.value = s
  }
}

realtime.on('OrderStatusChanged', () => void load(true))
realtime.on('OrderCreated', () => void load(true))
realtime.every(5000, () => load(true))

onMounted(() => {
  void load()
  clock = setInterval(() => (now.value = Date.now()), 1000)
})
onBeforeUnmount(() => {
  if (clock) clearInterval(clock)
})
</script>

<template>
  <v-container
    fluid
    class="py-6 px-4 px-md-8"
    style="max-width: 1400px"
  >
    <div class="d-flex flex-wrap align-center ga-3 mb-6">
      <v-btn
        to="/panel"
        variant="text"
        icon="mdi-arrow-left"
        aria-label="Volver al dashboard"
      />
      <div>
        <h1 class="text-h5 font-weight-bold">
          Producción
        </h1>
        <div class="text-caption text-medium-emphasis">
          Meta: cada pedido listo en menos de {{ ELABORATION_LIMIT_S }} s
        </div>
      </div>
      <RealtimeIndicator />
      <v-spacer />
      <v-chip
        v-if="overdue > 0"
        color="warning"
        variant="tonal"
        prepend-icon="mdi-timer-alert-outline"
      >
        {{ overdue }} fuera de tiempo
      </v-chip>
    </div>

    <v-skeleton-loader
      v-if="loading"
      type="card@2"
    />

    <StateError
      v-else-if="error"
      :error="error"
      @retry="load()"
    />

    <div
      v-else
      class="columns"
    >
      <!-- En elaboración -->
      <section>
        <h2 class="col-title">
          <v-icon
            icon="mdi-hammer-wrench"
            color="warning"
          /> En elaboración
          <span class="count">{{ inProduction.length }}</span>
        </h2>
        <StateEmpty
          v-if="inProduction.length === 0"
          icon="mdi-check-all"
          title="Nada en producción"
          description="Los pedidos nuevos aparecerán aquí automáticamente."
        />
        <TransitionGroup
          v-else
          name="card"
          tag="div"
          class="d-flex flex-column ga-3"
        >
          <v-card
            v-for="o in inProduction"
            :key="o.codigoOrden"
            border
            variant="flat"
            class="pa-4"
            :class="{ 'card--late': elapsed(o) > ELABORATION_LIMIT_S }"
          >
            <div class="d-flex align-center ga-2 mb-1">
              <strong>#{{ o.codigoOrden }}</strong>
              <v-spacer />
              <v-chip
                size="small"
                variant="tonal"
                :color="elapsed(o) > ELABORATION_LIMIT_S ? 'warning' : 'info'"
                prepend-icon="mdi-timer-outline"
              >
                {{ elapsedLabel(o) }}
              </v-chip>
            </div>
            <div class="text-body-2 text-medium-emphasis mb-3">
              {{ o.areaEntrega }} · {{ formatQ(o.total) }} · desde {{ formatTime(o.fechaCreacion) }}
            </div>
            <v-btn
              color="primary"
              block
              prepend-icon="mdi-package-variant-closed-check"
              :loading="marking.has(o.codigoOrden)"
              @click="markReady(o)"
            >
              Marcar listo para entrega
            </v-btn>
          </v-card>
        </TransitionGroup>
      </section>

      <!-- Listos -->
      <section>
        <h2 class="col-title">
          <v-icon
            icon="mdi-package-variant-closed-check"
            color="accent"
          /> Listos para entrega
          <span class="count">{{ ready.length }}</span>
        </h2>
        <StateEmpty
          v-if="ready.length === 0"
          icon="mdi-package-variant-closed"
          title="Sin pedidos esperando repartidor"
        />
        <TransitionGroup
          v-else
          name="card"
          tag="div"
          class="d-flex flex-column ga-2"
        >
          <div
            v-for="o in ready"
            :key="o.codigoOrden"
            class="ready-row"
          >
            <strong>#{{ o.codigoOrden }}</strong>
            <span class="text-medium-emphasis">{{ o.areaEntrega }}</span>
            <v-spacer />
            <span>{{ formatQ(o.total) }}</span>
          </div>
        </TransitionGroup>
      </section>
    </div>
  </v-container>
</template>

<style scoped>
.columns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24px;
  align-items: start;
}

.col-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.05rem;
  font-weight: 700;
  margin-bottom: 12px;
}

.count {
  margin-left: 4px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 0.8rem;
  background: var(--nt-surface-elevated);
}

.card--late {
  border-color: var(--nt-warning) !important;
}

.ready-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  background: var(--nt-surface);
  border: 1px solid var(--nt-border);
  border-radius: var(--nt-radius-md);
}

.card-enter-active,
.card-leave-active {
  transition: all 350ms ease;
}

.card-enter-from,
.card-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

@media (max-width: 800px) {
  .columns {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
