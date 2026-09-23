<script setup lang="ts">
import type { DeliveryOrderDto } from '../types/delivery'
import { AREA_ICONS, formatQ } from '../services/deliveryService'

defineProps<{ order: DeliveryOrderDto }>()
</script>

<template>
  <v-card
    :to="`/repartidor/pedido/${encodeURIComponent(order.codigoOrden)}`"
    border
    variant="flat"
    class="order"
  >
    <div class="order__top">
      <div class="order__area">
        <v-icon
          :icon="AREA_ICONS[order.areaEntrega] ?? 'mdi-map-marker-outline'"
          size="22"
        />
      </div>
      <div class="order__main">
        <div class="d-flex align-center ga-2">
          <strong>#{{ order.codigoOrden }}</strong>
          <v-spacer />
          <span class="font-weight-bold">{{ formatQ(order.total) }}</span>
        </div>
        <div class="text-body-2">
          {{ order.nicknameComprador }} · {{ order.areaEntrega }}
        </div>
        <div class="text-caption text-medium-emphasis text-truncate">
          {{ order.referenciaEntrega }}
        </div>
      </div>
    </div>
    <div class="order__bottom">
      <StatusChip
        :status="order.estado"
        size="x-small"
      />
      <v-chip
        size="x-small"
        variant="tonal"
        label
        :color="order.pago.estado === 'PAGADO' ? 'success' : 'warning'"
        :prepend-icon="order.pago.metodo === 'EFECTIVO' ? 'mdi-cash' : 'mdi-credit-card-outline'"
      >
        {{ order.pago.metodo === 'EFECTIVO' ? (order.pago.estado === 'PAGADO' ? 'Efectivo · pagado' : 'Cobrar en efectivo') : 'Tarjeta · pagado' }}
      </v-chip>
      <v-spacer />
      <v-icon
        icon="mdi-chevron-right"
        class="text-medium-emphasis"
      />
    </div>
  </v-card>
</template>

<style scoped>
.order {
  padding: 14px;
  transition: border-color var(--nt-transition-fast), transform var(--nt-transition-fast);
}

.order:hover {
  border-color: var(--nt-primary) !important;
}

.order__top {
  display: flex;
  gap: 12px;
}

.order__area {
  display: grid;
  place-items: center;
  flex: 0 0 44px;
  height: 44px;
  border-radius: var(--nt-radius-md);
  background: rgb(37 99 235 / 15%);
  color: var(--nt-primary);
}

.order__main {
  flex: 1;
  min-width: 0;
}

.order__bottom {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
}
</style>
