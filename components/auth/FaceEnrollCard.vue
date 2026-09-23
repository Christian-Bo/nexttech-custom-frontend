<script setup lang="ts">
import { ref } from 'vue'
import { isApiError } from '~/services/api'
import { useFaceService } from '~/services/faceService'
import type { FaceCaptureDto, FaceChallengeDto, FaceEnrollResultDto } from '~/types/auth'

/** Registro (enrolamiento) del rostro del comprador autenticado. */
const emit = defineEmits<{ enrolled: [result: FaceEnrollResultDto] }>()

const faceService = useFaceService()

const step = ref<'intro' | 'capture' | 'done'>('intro')
const challenge = ref<FaceChallengeDto | null>(null)
const busy = ref(false)
const error = ref<string | null>(null)
const result = ref<FaceEnrollResultDto | null>(null)

async function loadChallenge(): Promise<void> {
  busy.value = true
  error.value = null
  try {
    challenge.value = await faceService.challenge()
    step.value = 'capture'
  }
  catch (e) {
    error.value = isApiError(e) ? e.message : 'No se pudo iniciar el registro facial.'
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
    result.value = await faceService.enroll(challenge.value.id, capture)
    step.value = 'done'
    emit('enrolled', result.value)
  }
  catch (e) {
    const status = isApiError(e) ? e.status : 0
    error.value = status === 422
      ? 'No superaste la prueba de vida. Asegúrate de tener buena luz y de hacer el movimiento indicado.'
      : isApiError(e) ? e.message : 'No se pudo registrar tu rostro.'
    if (status === 422 || status === 400) await loadChallenge()
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <h3 class="text-subtitle-1 font-weight-semibold mb-3">
      Registra tu rostro
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

    <div
      v-if="step === 'intro'"
      class="d-flex flex-column ga-3"
    >
      <p class="text-body-2">
        Con tu rostro registrado podrás ingresar sin contraseña y obtener tu credencial digital.
      </p>
      <ul class="text-body-2 text-medium-emphasis pl-5">
        <li>Busca un lugar con buena luz y quítate lentes oscuros o gorra.</li>
        <li>Te pediremos una foto de frente y otra haciendo un movimiento.</li>
        <li>Guardamos tu foto; los datos biométricos no se almacenan.</li>
      </ul>
      <v-btn
        color="primary"
        prepend-icon="mdi-face-recognition"
        :loading="busy"
        @click="loadChallenge"
      >
        Comenzar
      </v-btn>
    </div>

    <FaceChallengeCapture
      v-else-if="step === 'capture'"
      :challenge="challenge"
      :busy="busy"
      submit-text="Registrar rostro"
      @submit="submit"
      @request-challenge="loadChallenge"
      @cancel="step = 'intro'"
    />

    <StateEmpty
      v-else
      icon="mdi-check-decagram"
      title="¡Rostro registrado!"
      :description="result?.message || 'Ya puedes ingresar con tu rostro y descargar tu credencial.'"
    />
  </div>
</template>
