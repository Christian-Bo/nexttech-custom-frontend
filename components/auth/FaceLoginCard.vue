<script setup lang="ts">
import { ref } from 'vue'
import { isApiError } from '~/services/api'
import { useAuthService } from '~/services/authService'
import { useAuthStore } from '~/stores/auth'
import type { AccessTokenResultDto, FaceCaptureDto, FaceChallengeDto } from '~/types/auth'

/** Login facial del comprador: identificador -> reto -> 2 fotos -> JWT. */
const emit = defineEmits<{ success: [result: AccessTokenResultDto] }>()

const authService = useAuthService()
const auth = useAuthStore()

const step = ref<'identifier' | 'capture'>('identifier')
const identifier = ref('')
const challenge = ref<FaceChallengeDto | null>(null)
const busy = ref(false)
const error = ref<string | null>(null)

async function loadChallenge(): Promise<void> {
  busy.value = true
  error.value = null
  try {
    challenge.value = await authService.faceChallenge()
    step.value = 'capture'
  }
  catch (e) {
    error.value = isApiError(e) ? e.message : 'No se pudo iniciar la verificación.'
  }
  finally {
    busy.value = false
  }
}

async function submit(capture: FaceCaptureDto): Promise<void> {
  if (!challenge.value) return
  busy.value = true
  error.value = null
  try {
    const result = await authService.faceLogin(identifier.value.trim(), challenge.value.id, capture)
    auth.setSession(result)
    emit('success', result)
  }
  catch (e) {
    const status = isApiError(e) ? e.status : 0
    // Seguridad: nunca distinguir "usuario no existe" de "rostro no coincide".
    error.value = status === 401
      ? 'No pudimos verificar tu identidad. Inténtalo de nuevo con buena luz.'
      : isApiError(e) ? e.message : 'No se pudo completar el ingreso facial.'
    // Cada intento necesita un reto nuevo.
    if (status !== 429) await loadChallenge()
  }
  finally {
    busy.value = false
  }
}

function cancel(): void {
  step.value = 'identifier'
  challenge.value = null
  error.value = null
}
</script>

<template>
  <div>
    <h3 class="text-subtitle-1 font-weight-semibold mb-3">
      Ingresa con tu rostro
    </h3>

    <v-alert
      v-if="error"
      type="error"
      variant="tonal"
      density="compact"
      class="mb-3"
    >
      {{ error }}
    </v-alert>

    <form
      v-if="step === 'identifier'"
      class="d-flex flex-column ga-3"
      @submit.prevent="loadChallenge"
    >
      <v-text-field
        v-model="identifier"
        label="Correo o nickname"
        prepend-inner-icon="mdi-account-outline"
        autocomplete="username"
        hide-details="auto"
      />
      <p class="text-caption text-medium-emphasis">
        Te pediremos dos fotos: una de frente y otra haciendo un movimiento. Solo funciona si ya registraste tu rostro.
      </p>
      <v-btn
        type="submit"
        color="primary"
        :loading="busy"
        :disabled="!identifier.trim()"
      >
        Continuar
      </v-btn>
    </form>

    <FaceChallengeCapture
      v-else
      :challenge="challenge"
      :busy="busy"
      submit-text="Ingresar"
      @submit="submit"
      @request-challenge="loadChallenge"
      @cancel="cancel"
    />
  </div>
</template>
