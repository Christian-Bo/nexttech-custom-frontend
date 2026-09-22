<script setup lang="ts">
withDefaults(defineProps<{
  title: string
  description?: string
  icon?: string
}>(), {
  description: undefined,
  icon: 'mdi-inbox-outline'
})
</script>

<template>
  <div
    class="state-empty"
    role="status"
  >
    <v-icon
      :icon="icon"
      size="56"
      class="state-empty__icon"
    />
    <h3 class="text-h6 font-weight-semibold">
      {{ title }}
    </h3>
    <p
      v-if="description"
      class="text-body-2 text-medium-emphasis"
    >
      {{ description }}
    </p>
    <div
      v-if="$slots.actions"
      class="mt-2"
    >
      <slot name="actions" />
    </div>
  </div>
</template>

<style scoped>
.state-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 3rem 1rem;
  text-align: center;
}

.state-empty__icon {
  color: var(--nt-text-muted);
  margin-bottom: 0.5rem;
}
</style>
