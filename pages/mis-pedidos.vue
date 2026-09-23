<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { MyOrder } from '~/features/orders/types/orders'
import { useOrdersService } from '~/features/orders/services/ordersService'
import { isApiError } from '~/services/api'
import type { ApiError } from '~/types/api'
import { formatDateTime, formatQ } from '~/utils/format'

definePageMeta({
  middleware: [
    (to) => {
      if (useRuntimeConfig().public.useMocks) return
      if (!useAuthStore().isBuyer) return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
    }
  ]
})
useHead({ title: 'Mis pedidos · NextTech Custom' })

const service = useOrdersService()
const realtime = useRealtime()
const orders = ref<MyOrder[]>([])
const loading = ref(true)
const error = ref<ApiError | null>(null)

const active = computed(() => orders.value.filter(o => !['ENTREGADO', 'COMPRADOR_NO_ENCONTRADO'].includes(o.estado)))
const finished = computed(() => orders.value.filter(o => ['ENTREGADO', 'COMPRADOR_NO_ENCONTRADO'].includes(o.estado)))

async function load(silent = false): Promise<void> {
  if (!silent) loading.value = true
  error.value = null
  try {
    orders.value = await service.myOrders()
  }
  catch (e) {
    if (!silent) error.value = isApiError(e) ? e : { status: 0, code: 'UNKNOWN', message: 'No se pudieron cargar tus pedidos.' }
  }
  finally {
    loading.value = false
  }
}

realtime.on('OrderStatusChanged', () => void load(true))
realtime.every(15_000, () => load(true))
onMounted(() => void load())
</script>

<template>
  <v-container
    class="py-8"
    style="max-width: 900px"
  >
    <div class="d-flex align-center flex-wrap ga-3 mb-6">
      <h1 class="text-h4 font-weight-bold">
        Mis pedidos
      </h1>
      <v-spacer />
      <RealtimeIndicator />
    </div>

    <v-skeleton-loader
      v-if="loading"
      type="list-item-two-line@3"
    />

    <StateError
      v-else-if="error"
      :error="error"
      @retry="load()"
    />

    <StateEmpty
      v-else-if="orders.length === 0"
      icon="mdi-receipt-text-outline"
      title="Todavía no tienes pedidos"
      description="Cuando compres algo, aquí vas a ver su avance."
    >
      <template #actions>
        <v-btn
          to="/catalogo"
          color="primary"
          class="text-none"
        >
          Ir al catálogo
        </v-btn>
      </template>
    </StateEmpty>

    <template v-else>
      <section
        v-if="active.length"
        class="mb-8"
      >
        <h2 class="section-title">
          En curso
        </h2>
        <div class="list">
          <v-card
            v-for="o in active"
            :key="o.codigoOrden"
            :to="`/seguimiento/${encodeURIComponent(o.codigoOrden)}`"
            border
            variant="flat"
            rounded="lg"
            class="order"
          >
            <div class="order__main">
              <div class="order__code">
                {{ o.codigoOrden }}
              </div>
              <div class="text-caption text-medium-emphasis">
                {{ formatDateTime(o.fechaCreacion) }}
              </div>
            </div>
            <StatusChip :status="o.estado" />
            <div class="order__total">
              {{ formatQ(o.total) }}
            </div>
            <v-icon icon="mdi-chevron-right" />
          </v-card>
        </div>
      </section>

      <section v-if="finished.length">
        <h2 class="section-title">
          Anteriores
        </h2>
        <div class="list">
          <v-card
            v-for="o in finished"
            :key="o.codigoOrden"
            :to="`/seguimiento/${encodeURIComponent(o.codigoOrden)}`"
            border
            variant="flat"
            rounded="lg"
            class="order order--past"
          >
            <div class="order__main">
              <div class="order__code">
                {{ o.codigoOrden }}
              </div>
              <div class="text-caption text-medium-emphasis">
                {{ formatDateTime(o.fechaCreacion) }}
              </div>
            </div>
            <StatusChip :status="o.estado" />
            <div class="order__total">
              {{ formatQ(o.total) }}
            </div>
            <v-icon icon="mdi-chevron-right" />
          </v-card>
        </div>
      </section>
    </template>
  </v-container>
</template>

<style scoped>
.section-title {
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--nt-text-muted);
  margin-bottom: 10px;
}

.list {
  display: grid;
  gap: 10px;
}

.order {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto 100px auto;
  align-items: center;
  gap: 16px;
  padding: 14px 18px;
  background: rgb(30 41 59 / 90%);
}

.order--past {
  opacity: 0.8;
}

.order__code {
  font-weight: 800;
  letter-spacing: 0.04em;
}

.order__total {
  text-align: right;
  font-weight: 700;
}

@media (max-width: 560px) {
  .order {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .order__total {
    text-align: left;
  }
}
</style>
