<script setup lang="ts">
import { computed } from 'vue'

const { state, accept, cancel } = useConfirm()

const open = computed({
  get: () => state.value.open,
  set: (value: boolean) => {
    if (!value) cancel()
  }
})
</script>

<template>
  <v-dialog
    v-model="open"
    max-width="440"
  >
    <v-card
      rounded="lg"
      border
    >
      <v-card-title class="text-h6 pt-5 px-6 d-flex align-center ga-2">
        <v-icon
          v-if="state.danger"
          icon="mdi-alert-outline"
          color="error"
        />
        {{ state.title }}
      </v-card-title>

      <v-card-text
        v-if="state.message"
        class="px-6 text-medium-emphasis"
      >
        {{ state.message }}
      </v-card-text>

      <v-card-actions class="px-6 pb-5">
        <v-spacer />
        <v-btn
          variant="text"
          @click="cancel"
        >
          {{ state.cancelText }}
        </v-btn>
        <v-btn
          :color="state.danger ? 'error' : 'primary'"
          variant="flat"
          @click="accept"
        >
          {{ state.confirmText }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
