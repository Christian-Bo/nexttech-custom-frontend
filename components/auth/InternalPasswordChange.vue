<script setup lang="ts">
import { computed, ref } from 'vue'
import { isApiError } from '~/services/api'
import { useInternalAuthService } from '~/services/internalAuthService'
import type { AccessTokenResultDto } from '~/types/auth'

/**
 * Cambio obligatorio de la contraseña temporal del personal interno.
 * Cambia la contraseña y vuelve a iniciar sesión para obtener un token sin la marca.
 */
const props = defineProps<{ email: string, currentPassword: string }>()
const emit = defineEmits<{ done: [result: AccessTokenResultDto], cancel: [] }>()

const service = useInternalAuthService()
const newPassword = ref('')
const confirmPassword = ref('')
const show = ref(false)
const saving = ref(false)
const error = ref<string | null>(null)

const rules = computed(() => {
  const p = newPassword.value
  return [
    { ok: p.length >= 8 && p.length <= 128, text: 'Entre 8 y 128 caracteres' },
    { ok: /[A-Z]/.test(p), text: 'Una mayúscula' },
    { ok: /[a-z]/.test(p), text: 'Una minúscula' },
    { ok: /\d/.test(p), text: 'Un número' },
    { ok: p.length > 0 && p !== props.currentPassword, text: 'Distinta a la temporal' },
    { ok: p.length > 0 && p === confirmPassword.value, text: 'Las contraseñas coinciden' }
  ]
})
const valid = computed(() => rules.value.every(r => r.ok))

async function submit(): Promise<void> {
  if (!valid.value) return
  saving.value = true
  error.value = null
  try {
    await service.changePassword(props.currentPassword, newPassword.value)
    emit('done', await service.login({ email: props.email, password: newPassword.value }))
  }
  catch (e) {
    error.value = isApiError(e) ? e.message : 'No se pudo cambiar la contraseña.'
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <v-form @submit.prevent="submit">
    <v-alert
      type="warning"
      variant="tonal"
      density="comfortable"
      class="mb-4"
    >
      Por seguridad, cambia tu contraseña temporal antes de continuar.
    </v-alert>

    <v-alert
      v-if="error"
      type="error"
      variant="tonal"
      density="comfortable"
      class="mb-4"
    >
      {{ error }}
    </v-alert>

    <v-text-field
      v-model="newPassword"
      label="Nueva contraseña"
      :type="show ? 'text' : 'password'"
      autocomplete="new-password"
      prepend-inner-icon="mdi-lock-reset"
      :append-inner-icon="show ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
      variant="outlined"
      color="accent"
      hide-details
      class="mb-3"
      @click:append-inner="show = !show"
    />
    <v-text-field
      v-model="confirmPassword"
      label="Repite la contraseña"
      :type="show ? 'text' : 'password'"
      autocomplete="new-password"
      prepend-inner-icon="mdi-lock-check-outline"
      variant="outlined"
      color="accent"
      hide-details
    />

    <ul class="rules my-4">
      <li
        v-for="r in rules"
        :key="r.text"
        :class="{ ok: r.ok }"
      >
        <v-icon
          :icon="r.ok ? 'mdi-check-circle' : 'mdi-circle-outline'"
          size="16"
        />
        {{ r.text }}
      </li>
    </ul>

    <v-btn
      type="submit"
      color="primary"
      variant="flat"
      size="large"
      block
      class="text-none"
      :loading="saving"
      :disabled="!valid"
    >
      Guardar y continuar
    </v-btn>
    <v-btn
      variant="text"
      block
      class="text-none mt-2"
      :disabled="saving"
      @click="emit('cancel')"
    >
      Cancelar
    </v-btn>
  </v-form>
</template>

<style scoped>
.rules {
  list-style: none;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px 12px;
  font-size: 0.85rem;
  color: var(--nt-text-muted);
}

.rules li {
  display: flex;
  align-items: center;
  gap: 6px;
}

.rules li.ok {
  color: var(--nt-success);
}
</style>
