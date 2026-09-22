<script setup lang="ts">
import { computed } from 'vue'
import type { OrderStatus } from '~/types/domain'

const props = withDefaults(defineProps<{
  status: OrderStatus
  size?: 'x-small' | 'small' | 'default' | 'large'
}>(), {
  size: 'small'
})

const STATUS_META: Record<OrderStatus, { label: string, color: string, icon: string }> = {
  ORDEN_GENERADA: { label: 'Orden generada', color: 'info', icon: 'mdi-receipt-text-outline' },
  EN_ELABORACION: { label: 'En elaboración', color: 'warning', icon: 'mdi-hammer-wrench' },
  LISTO_PARA_ENTREGA: { label: 'Listo para entrega', color: 'accent', icon: 'mdi-package-variant-closed-check' },
  EN_ENTREGA: { label: 'En entrega', color: 'primary', icon: 'mdi-truck-delivery-outline' },
  ENTREGADO: { label: 'Entregado', color: 'success', icon: 'mdi-check-circle-outline' },
  COMPRADOR_NO_ENCONTRADO: { label: 'Comprador no encontrado', color: 'error', icon: 'mdi-account-alert-outline' }
}

const meta = computed(() => STATUS_META[props.status])
</script>

<template>
  <v-chip
    :color="meta.color"
    :size="size"
    :prepend-icon="meta.icon"
    variant="tonal"
    label
  >
    {{ meta.label }}
  </v-chip>
</template>
