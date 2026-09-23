<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { ApiError } from '~/types/api'
import { isApiError } from '~/services/api'
import type { DeliveryOrderDto } from '~/features/delivery/types/delivery'
import { useDeliveryService } from '~/features/delivery/services/deliveryService'
import DeliveryOrderCard from '~/features/delivery/components/DeliveryOrderCard.vue'

definePageMeta({ layout: 'repartidor', middleware: 'repartidor' })
useHead({ title: 'Pedidos · Repartidor' })

const service = useDeliveryService()
const orders = ref<DeliveryOrderDto[]>([])
const loading = ref(true)
const error = ref<ApiError | null>(null)
const tab = ref<'pending' | 'done'>('pending')

const ACTIVE = ['LISTO_PARA_ENTREGA', 'EN_ENTREGA']

const pending = computed(() =>
  orders.value
    .filter(o => ACTIVE.includes(o.estado))
    // En entrega primero, luego por antigüedad.
    .sort((a, b) => Number(b.estado === 'EN_ENTREGA') - Number(a.estado === 'EN_ENTREGA') || a.fechaCreacion.localeCompare(b.fechaCreacion))
)
const done = computed(() => orders.value.filter(o => !ACTIVE.includes(o.estado)))
const delivered = computed(() => done.value.filter(o => o.estado === 'ENTREGADO').length)
const efficiency = computed(() => done.value.length ? Math.round(delivered.value / done.value.length * 100) : 100)
const visible = computed(() => (tab.value === 'pending' ? pending.value : done.value))

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    orders.value = await service.listAssigned()
  }
  catch (e) {
    error.value = isApiError(e) ? e : { status: 0, code: 'UNKNOWN', message: 'No se pudieron cargar tus pedidos.' }
  }
  finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div>
    <div class="kpis">
      <div class="kpi">
        <span class="kpi__value">{{ pending.length }}</span>
        <span class="kpi__label">Pendientes</span>
      </div>
      <div class="kpi">
        <span class="kpi__value">{{ delivered }}</span>
        <span class="kpi__label">Entregadas</span>
      </div>
      <div class="kpi">
        <span class="kpi__value">{{ efficiency }}%</span>
        <span class="kpi__label">Efectividad</span>
      </div>
    </div>

    <div class="d-flex align-center mb-3">
      <v-btn-toggle
        v-model="tab"
        mandatory
        density="compact"
        variant="outlined"
        color="primary"
      >
        <v-btn value="pending">
          Pendientes
        </v-btn>
        <v-btn value="done">
          Completadas
        </v-btn>
      </v-btn-toggle>
      <v-spacer />
      <v-btn
        icon="mdi-refresh"
        variant="text"
        :loading="loading"
        aria-label="Actualizar"
        @click="load"
      />
    </div>

    <div
      v-if="loading && orders.length === 0"
      class="d-flex flex-column ga-3"
    >
      <v-skeleton-loader
        v-for="i in 3"
        :key="i"
        type="list-item-avatar-three-line"
      />
    </div>

    <StateError
      v-else-if="error"
      :error="error"
      :retrying="loading"
      @retry="load"
    />

    <StateEmpty
      v-else-if="visible.length === 0"
      :icon="tab === 'pending' ? 'mdi-check-all' : 'mdi-history'"
      :title="tab === 'pending' ? '¡Todo entregado!' : 'Aún no hay entregas completadas'"
      :description="tab === 'pending' ? 'No tienes pedidos pendientes por ahora.' : undefined"
    />

    <div
      v-else
      class="d-flex flex-column ga-3"
    >
      <DeliveryOrderCard
        v-for="o in visible"
        :key="o.idOrden"
        :order="o"
      />
    </div>
  </div>
</template>

<style scoped>
.kpis {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 16px;
}

.kpi {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 8px;
  background: var(--nt-surface);
  border: 1px solid var(--nt-border);
  border-radius: var(--nt-radius-md);
}

.kpi__value {
  font-size: 1.5rem;
  font-weight: 700;
}

.kpi__label {
  font-size: 0.75rem;
  color: var(--nt-text-muted);
}
</style>
