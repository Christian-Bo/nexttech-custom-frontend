<script setup lang="ts">
import type { RecentOrderDto } from '../types/dashboard'
import { formatQ, timeAgo } from '~/utils/format'

defineProps<{
  orders: RecentOrderDto[]
  /** Ids recién llegados por tiempo real (se resaltan). */
  highlight?: Set<number>
}>()
</script>

<template>
  <div class="table-wrap">
    <v-table density="comfortable">
      <thead>
        <tr>
          <th>Pedido</th>
          <th>Cliente</th>
          <th class="d-none d-md-table-cell">
            Producto
          </th>
          <th class="text-right">
            Total
          </th>
          <th>Estado</th>
          <th class="d-none d-sm-table-cell">
            Hace
          </th>
        </tr>
      </thead>
      <TransitionGroup
        name="row"
        tag="tbody"
      >
        <tr
          v-for="o in orders"
          :key="o.idOrden"
          :class="{ 'row--new': highlight?.has(o.idOrden) }"
        >
          <td class="font-weight-medium">
            #{{ o.codigoOrden }}
          </td>
          <td>{{ o.nickname }}</td>
          <td class="d-none d-md-table-cell text-medium-emphasis">
            {{ o.producto }}
          </td>
          <td class="text-right num">
            {{ formatQ(o.total) }}
          </td>
          <td>
            <StatusChip
              :status="o.estado"
              size="x-small"
            />
          </td>
          <td class="d-none d-sm-table-cell text-medium-emphasis">
            {{ timeAgo(o.fechaCreacion) }}
          </td>
        </tr>
      </TransitionGroup>
    </v-table>
  </div>
</template>

<style scoped>
.table-wrap {
  overflow-x: auto;
}

.table-wrap :deep(.v-table) {
  background: transparent;
}

.num {
  font-variant-numeric: tabular-nums;
}

.row--new {
  animation: newrow 2s ease;
}

.row-enter-active {
  transition: opacity 400ms ease, transform 400ms ease;
}

.row-enter-from {
  opacity: 0;
  transform: translateY(-6px);
}

@keyframes newrow {
  0% { background: rgb(6 182 212 / 18%); }
  100% { background: transparent; }
}
</style>
