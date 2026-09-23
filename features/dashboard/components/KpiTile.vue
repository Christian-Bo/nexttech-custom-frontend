<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  label: string
  value: string
  icon: string
  /** % vs período anterior (subir es bueno). */
  delta?: number | null
  hint?: string
  /** Destello cuando el valor cambió en vivo. */
  flash?: boolean
}>(), {
  delta: null,
  hint: undefined,
  flash: false
})

const deltaView = computed(() => {
  if (props.delta === null || !Number.isFinite(props.delta)) return null
  const up = props.delta >= 0
  return {
    text: `${up ? '+' : '−'}${Math.abs(props.delta).toFixed(0)}%`,
    icon: up ? 'mdi-arrow-up' : 'mdi-arrow-down',
    color: up ? 'success' : 'error'
  }
})
</script>

<template>
  <div
    class="kpi"
    :class="{ 'kpi--flash': flash }"
  >
    <div class="kpi__head">
      <span class="kpi__label">{{ label }}</span>
      <v-icon
        :icon="icon"
        size="20"
        class="kpi__icon"
      />
    </div>
    <div class="kpi__value">
      {{ value }}
    </div>
    <div class="kpi__foot">
      <span
        v-if="deltaView"
        class="kpi__delta"
        :class="`text-${deltaView.color}`"
      >
        <v-icon
          :icon="deltaView.icon"
          size="14"
        />{{ deltaView.text }}
      </span>
      <span
        v-if="hint"
        class="kpi__hint"
      >{{ hint }}</span>
    </div>
  </div>
</template>

<style scoped>
.kpi {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 16px;
  background: var(--nt-surface);
  border: 1px solid var(--nt-border);
  border-radius: var(--nt-radius-lg);
  transition: border-color var(--nt-transition-base);
}

.kpi--flash {
  animation: flash 1.2s ease;
}

.kpi__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.kpi__label {
  font-size: 0.85rem;
  color: var(--nt-text-secondary);
}

.kpi__icon {
  color: var(--nt-text-muted);
}

.kpi__value {
  font-size: 1.75rem;
  font-weight: 600;
  line-height: 1.2;
  color: var(--nt-text);
}

.kpi__foot {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 18px;
  font-size: 0.78rem;
}

.kpi__delta {
  display: inline-flex;
  align-items: center;
  font-weight: 600;
}

.kpi__hint {
  color: var(--nt-text-muted);
}

@keyframes flash {
  0% { border-color: var(--nt-accent); box-shadow: 0 0 0 3px rgb(6 182 212 / 25%); }
  100% { border-color: var(--nt-border); box-shadow: none; }
}
</style>
