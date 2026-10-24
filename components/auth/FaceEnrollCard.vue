<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { isApiError } from '~/services/api'
import { useFaceService } from '~/services/faceService'
import type { FaceCaptureDto, FaceChallengeDto, FaceEnrollResultDto } from '~/types/auth'

/** Registro (enrolamiento) del rostro del comprador autenticado. */
const emit = defineEmits<{ enrolled: [result: FaceEnrollResultDto] }>()
const props = withDefaults(defineProps<{ showCredentialLink?: boolean }>(), { showCredentialLink: true })

const faceService = useFaceService()

const step = ref<'intro' | 'capture' | 'done'>('intro')
const challenge = ref<FaceChallengeDto | null>(null)
const busy = ref(false)
const error = ref<string | null>(null)
const result = ref<FaceEnrollResultDto | null>(null)
const segmentedPreview = ref<string | null>(null)
const segmenting = ref(false)
const segmentWarning = ref<string | null>(null)

let active = true
onBeforeUnmount(() => {
  active = false
  if (segmentedPreview.value) URL.revokeObjectURL(segmentedPreview.value)
})

/** Vista previa únicamente: las fotos originales siguen intactas para liveness. */
async function previewSegmentation(original: Blob): Promise<void> {
  segmenting.value = true
  segmentWarning.value = null
  try {
    const image = await faceService.segmentCard(original)
    if (!image.type.startsWith('image/') || image.size === 0) throw new Error('Imagen segmentada inválida')
    if (!active) return
    if (segmentedPreview.value) URL.revokeObjectURL(segmentedPreview.value)
    segmentedPreview.value = URL.createObjectURL(image)
  }
  catch {
    segmentWarning.value = 'Se registró tu rostro, pero no se pudo obtener la vista previa sin fondo.'
  }
  finally {
    segmenting.value = false
  }
}

/**
 * Se entra a la cámara SIN pedir el reto todavía: descargar MediaPipe y
 * encender la cámara toma varios segundos y antes eso se comía el minuto que
 * dura el reto. El propio componente lo pide cuando ya tiene el rostro
 * encuadrado, así el usuario estrena el reloj con todo listo.
 */
function comenzar(): void {
  error.value = null
  step.value = 'capture'
}

/** keepError: al reintentar tras un fallo se conserva el mensaje para que el usuario sepa qué pasó. */
async function loadChallenge(keepError = false): Promise<void> {
  busy.value = true
  if (!keepError) error.value = null
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
  if (!challenge.value || busy.value) return
  busy.value = true
  error.value = null
  try {
    result.value = await faceService.completeOnboarding(challenge.value.id, capture)
    step.value = 'done'
    emit('enrolled', result.value)
  }
  catch (e) {
    const status = isApiError(e) ? e.status : 0
    const mensaje = isApiError(e) ? e.message : ''
    error.value = status === 422
      ? 'No superaste la prueba de vida. Busca mejor luz y haz el movimiento despacio, siguiendo la flecha de la pantalla.'
      : /expir|caduc/i.test(mensaje)
        ? 'La prueba caducó antes de llegar al servidor. Ya pedimos una nueva: sigue las indicaciones de la cámara.'
        : mensaje || 'No se pudo registrar tu rostro.'
    if (status === 422 || status === 400) await loadChallenge(true)
  }
  finally {
    busy.value = false
  }
  // Se consulta el endpoint de segmentación tras enrolar, sin retrasar el reto de vida.
  // La API de credenciales genera su PDF con el retrato persistido en Oracle,
  // NO con esta vista previa. Si se desea modificar el PDF, el backend debe guardar
  // también la fotografía segmentada.
  if (step.value === 'done') await previewSegmentation(capture.neutralImage)
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
        <li>La cámara tomará las fotos automáticamente: una de frente y otra haciendo un movimiento.</li>
        <li>Para el movimiento, <strong>sigue la flecha azul</strong> que aparece sobre tu cabeza y gira despacio.</li>
        <li>El servidor conserva las fotografías necesarias para la verificación facial.</li>
      </ul>
      <v-btn
        color="primary"
        prepend-icon="mdi-face-recognition"
        @click="comenzar"
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
      @request-challenge="loadChallenge()"
      @cancel="step = 'intro'"
    />

    <div v-else class="d-flex flex-column ga-3">
      <StateEmpty
        icon="mdi-check-decagram"
        title="¡Rostro registrado!"
        :description="result?.message || 'Ya puedes ingresar con tu rostro y descargar tu credencial.'"
      />
      <div v-if="segmenting" class="d-flex align-center ga-2 text-body-2 text-medium-emphasis">
        <v-progress-circular indeterminate size="18" width="2" color="primary" />
        Preparando vista previa sin fondo…
      </div>
      <v-alert v-if="segmentWarning" type="warning" variant="tonal" density="compact">
        {{ segmentWarning }}
      </v-alert>
      <v-btn
        v-if="props.showCredentialLink"
        to="/mi-credencial"
        color="primary"
        prepend-icon="mdi-card-account-details-outline"
        class="text-none"
      >
        Personalizar mi credencial oficial
      </v-btn>
      <div v-if="segmentedPreview" class="d-flex flex-column align-center ga-2">
        <v-img
          :src="segmentedPreview"
          alt="Vista previa del rostro segmentado"
          width="220"
          max-width="100%"
          class="rounded-lg"
        />
        <p class="text-caption text-medium-emphasis text-center">
          Vista previa del recorte de rostro. La credencial oficial utiliza el retrato almacenado por el servidor.
        </p>
      </div>
    </div>
  </div>
</template>
