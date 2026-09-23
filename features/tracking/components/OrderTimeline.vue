<script setup lang="ts">
import { computed } from 'vue'
import type { OrderStatus } from '~/types/domain'
import type { TrackingStepDto } from '../types/tracking'
import { formatDateTime } from '~/utils/format'

/**
 * Línea de tiempo del pedido.
 * audience 'buyer': el comprador ve hasta "Listo para entrega" (+ resultado final).
 * audience 'staff': flujo operativo completo.
 */
const props = withDefaults(defineProps<{
  estado: OrderStatus
  historial: TrackingStepDto[]
  audience?: 'buyer' | 'staff'
}>(), {
  audience: 'buyer'
})

const STEP_META: Record<OrderStatus, { label: string, icon: string, hint: string }> = {
  ORDEN_GENERADA: { label: 'Pedido recibido', icon: 'mdi-receipt-text-check-outline', hint: 'Recibimos tu pedido y tu diseño.' },
  EN_ELABORACION: { label: 'En elaboración', icon: 'mdi-hammer-wrench', hint: 'Estamos fabricando tu producto.' },
  LISTO_PARA_ENTREGA: { label: 'Listo para entrega', icon: 'mdi-package-variant-closed-check', hint: 'Tu pedido está listo. Ten a mano tu QR de entrega.' },
  EN_ENTREGA: { label: 'En camino', icon: 'mdi-truck-fast-outline', hint: 'El repartidor va hacia tu punto de entrega.' },
  ENTREGADO: { label: 'Entregado', icon: 'mdi-check-decagram', hint: '¡Disfrútalo!' },
  COMPRADOR_NO_ENCONTRADO: { label: 'No te encontramos', icon: 'mdi-account-alert-outline', hint: 'Te contactaremos para coordinar una nueva entrega.' }
}

const steps = computed<OrderStatus[]>(() => {
  const base: OrderStatus[] = props.audience === 'buyer'
    ? ['ORDEN_GENERADA', 'EN_ELABORACION', 'LISTO_PARA_ENTREGA']
    : ['ORDEN_GENERADA', 'EN_ELABORACION', 'LISTO_PARA_ENTREGA', 'EN_ENTREGA']
  const final: OrderStatus = props.estado === 'COMPRADOR_NO_ENCONTRADO' ? 'COMPRADOR_NO_ENCONTRADO' : 'ENTREGADO'
  return [...base, final]
})

const ORDER: OrderStatus[] = ['ORDEN_GENERADA', 'EN_ELABORACION', 'LISTO_PARA_ENTREGA', 'EN_ENTREGA', 'ENTREGADO', 'COMPRADOR_NO_ENCONTRADO']

/** Índice del paso actual dentro de los pasos visibles. */
const currentIndex = computed(() => {
  const rank = ORDER.indexOf(props.estado)
  let idx = 0
  steps.value.forEach((s, i) => {
    if (ORDER.indexOf(s) <= rank) idx = i
  })
  return idx
})

function whenOf(state: OrderStatus): string | null {
  const h = [...props.historial].reverse().find(x => x.estado === state)
  return h ? formatDateTime(h.fechaHora) : null
}

const isFailed = computed(() => props.estado === 'COMPRADOR_NO_ENCONTRADO')
</script>

<template>
  <ol
    class="timeline"
    aria-label="Estado del pedido"
  >
    <li
      v-for="(s, i) in steps"
      :key="s"
      class="step"
      :class="{
        'step--done': i < currentIndex,
        'step--current': i === currentIndex,
        'step--failed': isFailed && i === currentIndex
      }"
      :aria-current="i === currentIndex ? 'step' : undefined"
    >
      <div class="step__marker">
        <v-icon
          :icon="STEP_META[s].icon"
          size="20"
        />
      </div>
      <div class="step__body">
        <div class="step__label">
          {{ STEP_META[s].label }}
        </div>
        <div
          v-if="i <= currentIndex && whenOf(s)"
          class="step__time"
        >
          {{ whenOf(s) }}
        </div>
        <Transition name="hint">
          <p
            v-if="i === currentIndex"
            :key="s"
            class="step__hint"
          >
            {{ STEP_META[s].hint }}
          </p>
        </Transition>
      </div>
    </li>
  </ol>
</template>

<style scoped>
.timeline {
  list-style: none;
  margin: 0;
  padding: 0;
}

.step {
  position: relative;
  display: flex;
  gap: 14px;
  padding-bottom: 22px;
}

.step:last-child {
  padding-bottom: 0;
}

/* Conector vertical */
.step:not(:last-child)::before {
  content: '';
  position: absolute;
  left: 19px;
  top: 40px;
  bottom: 2px;
  width: 2px;
  background: var(--nt-border);
  transition: background var(--nt-transition-base);
}

.step--done:not(:last-child)::before {
  background: var(--nt-primary);
}

.step__marker {
  flex: 0 0 40px;
  height: 40px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  border: 2px solid var(--nt-border);
  background: var(--nt-surface);
  color: var(--nt-text-muted);
  transition: all 400ms ease;
}

.step--done .step__marker {
  border-color: var(--nt-primary);
  background: var(--nt-primary);
  color: var(--nt-text);
}

.step--current .step__marker {
  border-color: var(--nt-accent);
  color: var(--nt-accent);
  box-shadow: 0 0 0 6px rgb(6 182 212 / 15%);
  animation: pop 500ms ease;
}

.step--failed .step__marker {
  border-color: var(--nt-error);
  color: var(--nt-error);
  box-shadow: 0 0 0 6px rgb(239 68 68 / 15%);
}

.step__body {
  padding-top: 8px;
  min-width: 0;
}

.step__label {
  font-weight: 600;
  color: var(--nt-text-muted);
}

.step--done .step__label,
.step--current .step__label {
  color: var(--nt-text);
}

.step__time {
  font-size: 0.8rem;
  color: var(--nt-text-muted);
}

.step__hint {
  margin-top: 4px;
  font-size: 0.875rem;
  color: var(--nt-text-secondary);
}

.hint-enter-active {
  transition: opacity 400ms ease, transform 400ms ease;
}

.hint-enter-from {
  opacity: 0;
  transform: translateY(-4px);
}

@keyframes pop {
  0% { transform: scale(0.85); }
  60% { transform: scale(1.08); }
  100% { transform: scale(1); }
}
</style>
