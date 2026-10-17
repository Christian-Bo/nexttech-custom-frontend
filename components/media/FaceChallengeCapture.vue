<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { FaceLandmarker, NormalizedLandmark } from '@mediapipe/tasks-vision'
import type { FaceCaptureDto, FaceChallengeDto } from '~/types/auth'
import { FACE_MAX_IMAGE_BYTES } from '~/types/auth'

const props = withDefaults(defineProps<{
  challenge: FaceChallengeDto | null
  busy?: boolean
  submitText?: string
}>(), {
  busy: false,
  submitText: 'Verificar'
})

const emit = defineEmits<{
  submit: [capture: FaceCaptureDto]
  'request-challenge': []
  cancel: []
}>()

type Step = 'neutral' | 'challenge' | 'sending'

const videoEl = ref<HTMLVideoElement | null>(null)
const camera = useCamera('user')
const step = ref<Step>('neutral')
const message = ref('Preparando la detección facial…')
const progress = ref(0)
const remaining = ref(0)
const loadingModel = ref(false)
const capturing = ref(false)
const error = ref<string | null>(null)

const expired = computed(() => !!props.challenge && remaining.value <= 0)
const action = computed(() => (props.challenge?.action ?? '').toUpperCase())
const hint = computed(() => {
  if (action.value.includes('BLINK')) return { icon: 'mdi-eye-outline', text: 'Parpadea' }
  if (action.value.includes('SMILE')) return { icon: 'mdi-emoticon-happy-outline', text: 'Sonríe' }
  if (action.value.includes('UP')) return { icon: 'mdi-arrow-up-bold', text: 'Mira hacia arriba' }
  if (action.value.includes('DOWN')) return { icon: 'mdi-arrow-down-bold', text: 'Mira hacia abajo' }
  if (action.value.includes('LEFT')) return { icon: 'mdi-arrow-left-bold', text: 'Gira la cabeza hacia tu derecha' }
  if (action.value.includes('RIGHT')) return { icon: 'mdi-arrow-right-bold', text: 'Gira la cabeza hacia tu izquierda' }
  return { icon: 'mdi-face-recognition', text: 'Sigue el movimiento indicado' }
})

let landmarker: FaceLandmarker | null = null
let scanInterval: ReturnType<typeof setInterval> | null = null
let expiryInterval: ReturnType<typeof setInterval> | null = null
let scanVersion = 0
let disposed = false
let stableSince = 0
let matchedSince = 0
let previousCenter: { x: number, y: number } | null = null
let neutralImage: Blob | null = null
let neutralYaw = 0
let neutralNoseY = 0
let fallbackExpiryMs = 0
let processingFrame = false

const NEUTRAL_HOLD_MS = 1200
const CHALLENGE_HOLD_MS = 450

function updateRemaining(): void {
  if (!props.challenge) {
    remaining.value = 0
    return
  }
  const parsed = Date.parse(props.challenge.expiresAtUtc)
  const endsAt = Number.isFinite(parsed) ? parsed : fallbackExpiryMs
  remaining.value = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))
  if (remaining.value === 0 && step.value !== 'sending') {
    progress.value = 0
    message.value = 'El reto expiró. Solicita uno nuevo.'
  }
}

async function loadDetector(): Promise<boolean> {
  if (landmarker) return true
  loadingModel.value = true
  error.value = null
  try {
    const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision')
    const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.0/wasm')
    const detector = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task', delegate: 'CPU' },
      runningMode: 'VIDEO',
      numFaces: 2,
      minFaceDetectionConfidence: 0.65,
      minFacePresenceConfidence: 0.65,
      minTrackingConfidence: 0.65,
      outputFaceBlendshapes: true
    })
    if (disposed) {
      detector.close()
      return false
    }
    landmarker = detector
    return true
  }
  catch {
    error.value = 'No se pudo cargar el detector facial. Verifica los archivos de MediaPipe en public/mediapipe.'
    return false
  }
  finally {
    loadingModel.value = false
  }
}

function stopScanning(): void {
  scanVersion++
  if (scanInterval) clearInterval(scanInterval)
  scanInterval = null
  processingFrame = false
}

function resetCapture(): void {
  stopScanning()
  neutralImage = null
  neutralYaw = 0
  neutralNoseY = 0
  stableSince = 0
  matchedSince = 0
  previousCenter = null
  progress.value = 0
  step.value = 'neutral'
  message.value = 'Coloca tu rostro dentro del marco.'
  error.value = null
  capturing.value = false
}

async function startCapture(): Promise<void> {
  resetCapture()
  updateRemaining()
  if (!props.challenge || expired.value) return
  const version = scanVersion
  if (!await loadDetector() || disposed || version !== scanVersion) return
  const started = await camera.start(videoEl.value)
  if (!started || disposed || version !== scanVersion) {
    camera.stop()
    return
  }
  message.value = 'Buscando un rostro…'
  scanInterval = setInterval(() => { void analyzeFrame(version) }, 180)
}

function geometry(points: NormalizedLandmark[]) {
  let minX = 1
  let maxX = 0
  let minY = 1
  let maxY = 0
  for (const point of points) {
    minX = Math.min(minX, point.x)
    maxX = Math.max(maxX, point.x)
    minY = Math.min(minY, point.y)
    maxY = Math.max(maxY, point.y)
  }
  const leftEye = points[33]!
  const rightEye = points[263]!
  const nose = points[1]!
  const eyeDistance = Math.max(Math.abs(leftEye.x - rightEye.x), 0.01)
  return {
    center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
    width: maxX - minX,
    height: maxY - minY,
    yaw: (nose.x - (leftEye.x + rightEye.x) / 2) / eyeDistance,
    noseY: nose.y
  }
}

function movementSatisfied(
  face: ReturnType<typeof geometry>,
  scores: Record<string, number>
): boolean {
  const name = action.value
  const deltaYaw = face.yaw - neutralYaw
  if (name.includes('IMAGE_LEFT')) return deltaYaw < -0.17
  if (name.includes('IMAGE_RIGHT')) return deltaYaw > 0.17
  if (name.includes('LEFT')) return deltaYaw < -0.17
  if (name.includes('RIGHT')) return deltaYaw > 0.17
  if (name.includes('BLINK')) return (scores.eyeBlinkLeft ?? 0) > 0.65 && (scores.eyeBlinkRight ?? 0) > 0.65
  if (name.includes('SMILE')) return (scores.mouthSmileLeft ?? 0) > 0.55 && (scores.mouthSmileRight ?? 0) > 0.55
  if (name.includes('UP')) return face.noseY - neutralNoseY < -0.06
  if (name.includes('DOWN')) return face.noseY - neutralNoseY > 0.06
  return false
}

async function shoot(version: number): Promise<Blob | null> {
  if (capturing.value) return null
  capturing.value = true
  try {
    const blob = await camera.capture(0.85)
    if (version !== scanVersion || disposed || !blob) return null
    if (blob.size > FACE_MAX_IMAGE_BYTES) {
      error.value = 'La fotografía supera el tamaño permitido. Repite el proceso.'
      return null
    }
    return blob
  }
  finally {
    capturing.value = false
  }
}

async function analyzeFrame(version: number): Promise<void> {
  if (version !== scanVersion || disposed || props.busy || capturing.value || processingFrame || expired.value || step.value === 'sending') return
  const video = videoEl.value
  if (!landmarker || !video || video.readyState < 2 || !camera.isActive.value) return
  processingFrame = true
  try {
    const result = landmarker.detectForVideo(video, performance.now())
    if (version !== scanVersion) return
    if (result.faceLandmarks.length !== 1) {
      progress.value = 0
      stableSince = 0
      matchedSince = 0
      previousCenter = null
      message.value = result.faceLandmarks.length > 1 ? 'Debe aparecer una sola persona.' : 'Acércate y coloca tu rostro frente a la cámara.'
      return
    }

    const face = geometry(result.faceLandmarks[0]!)
    const framed = Math.abs(face.center.x - 0.5) < 0.16
      && Math.abs(face.center.y - 0.5) < 0.18
      && face.width > 0.22 && face.width < 0.75
      && face.height > 0.25 && face.height < 0.86

    if (!framed) {
      progress.value = 0
      stableSince = 0
      matchedSince = 0
      previousCenter = null
      message.value = 'Centra tu rostro y ajusta la distancia.'
      return
    }

    const now = performance.now()
    if (step.value === 'neutral') {
      const steady = !previousCenter || (Math.hypot(
        face.center.x - previousCenter.x,
        face.center.y - previousCenter.y
      ) < 0.022 && Math.abs(face.yaw) < 0.22)
      previousCenter = face.center
      if (!steady) stableSince = 0
      if (!stableSince) stableSince = now
      progress.value = Math.min(100, Math.round((now - stableSince) / NEUTRAL_HOLD_MS * 100))
      message.value = 'Rostro detectado. Mantente mirando de frente.'
      if (progress.value < 100) return
      const blob = await shoot(version)
      if (!blob) return
      neutralImage = blob
      neutralYaw = face.yaw
      neutralNoseY = face.noseY
      matchedSince = 0
      progress.value = 0
      step.value = 'challenge'
      message.value = props.challenge?.instruction || hint.value.text
      return
    }

    if (step.value === 'challenge') {
      const scores = Object.fromEntries((result.faceBlendshapes[0]?.categories ?? [])
        .map(item => [item.categoryName, item.score]))
      const matched = movementSatisfied(face, scores)
      if (!matched) matchedSince = 0
      if (!matchedSince && matched) matchedSince = now
      const holdTime = action.value.includes('BLINK') ? 180 : CHALLENGE_HOLD_MS
      progress.value = matched ? Math.min(100, Math.round((now - matchedSince) / holdTime * 100)) : 0
      message.value = matched ? 'Movimiento detectado. Mantén la posición.' : (props.challenge?.instruction || hint.value.text)
      if (progress.value < 100 || !neutralImage) return
      const blob = await shoot(version)
      if (!blob) return
      const capturedNeutral = neutralImage
      step.value = 'sending'
      progress.value = 100
      message.value = 'Fotografías listas. Verificando en el servidor…'
      stopScanning()
      camera.stop()
      emit('submit', { neutralImage: capturedNeutral, challengeImage: blob })
    }
  }
  catch {
    error.value = 'No se pudo analizar la imagen de la cámara. Reintenta.'
    stopScanning()
  }
  finally {
    processingFrame = false
  }
}

function cancel(): void {
  stopScanning()
  camera.stop()
  emit('cancel')
}

watch(() => props.challenge?.id, (id, previousId) => {
  if (id && id !== previousId && !disposed) {
    fallbackExpiryMs = Date.now() + (props.challenge?.expiresInSeconds ?? 60) * 1000
    void startCapture()
  }
})

onMounted(() => {
  fallbackExpiryMs = Date.now() + (props.challenge?.expiresInSeconds ?? 60) * 1000
  updateRemaining()
  expiryInterval = setInterval(updateRemaining, 300)
  if (props.challenge) void startCapture()
})

onBeforeUnmount(() => {
  disposed = true
  stopScanning()
  if (expiryInterval) clearInterval(expiryInterval)
  camera.stop()
  landmarker?.close()
  landmarker = null
})
</script>

<template>
  <div class="face">
    <div class="face__instruction">
      <v-icon :icon="step === 'neutral' ? 'mdi-face-recognition' : 'mdi-shield-check-outline'" color="accent" />
      <span class="text-body-2">
        <strong>{{ step === 'neutral' ? 'Paso 1 de 2' : 'Paso 2 de 2' }}:</strong>
        {{ message }}
      </span>
      <v-spacer />
      <v-chip v-if="challenge" size="small" variant="tonal" :color="expired ? 'error' : 'primary'">
        {{ expired ? 'Expirado' : `${remaining}s` }}
      </v-chip>
    </div>

    <div class="face__viewport">
      <video
        ref="videoEl"
        class="face__video"
        muted
        playsinline
        aria-label="Cámara para el reconocimiento facial"
      />
      <div class="face__oval" :class="{ 'face__oval--ready': progress > 15 }" aria-hidden="true" />
      <v-icon
        v-if="step === 'challenge' && !expired"
        class="face__hint-icon"
        :icon="hint.icon"
        size="52"
        color="accent"
      />
      <div v-if="!camera.isActive.value || loadingModel || expired" class="face__overlay">
        <v-progress-circular v-if="loadingModel || camera.isStarting.value || busy" indeterminate color="primary" />
        <template v-else-if="!expired && step !== 'sending'">
          <p class="text-body-2 mb-3">{{ camera.error.value?.message || 'Activa tu cámara para continuar.' }}</p>
          <v-btn color="primary" prepend-icon="mdi-camera" @click="startCapture">Activar cámara</v-btn>
        </template>
        <span v-else-if="expired" class="text-body-2">Reto expirado</span>
        <span v-else class="text-body-2">Validando tu identidad…</span>
      </div>
    </div>

    <div class="face__progress">
      <v-progress-linear :model-value="progress" color="accent" height="8" rounded />
      <span class="text-caption text-medium-emphasis">
        {{ step === 'sending' ? 'Enviando captura' : `Detección: ${progress}%` }}
      </span>
    </div>

    <v-alert v-if="error" type="warning" variant="tonal" density="compact">{{ error }}</v-alert>
    <div class="face__actions">
      <v-btn variant="text" :disabled="busy" @click="cancel">Cancelar</v-btn>
      <v-spacer />
      <v-btn v-if="expired" color="primary" prepend-icon="mdi-refresh" :loading="busy" @click="emit('request-challenge')">
        Nuevo reto
      </v-btn>
      <v-btn v-else-if="step !== 'sending'" variant="tonal" prepend-icon="mdi-refresh" :disabled="busy || loadingModel" @click="startCapture">
        Reintentar
      </v-btn>
      <v-chip v-else color="success" variant="tonal" prepend-icon="mdi-check-circle">
        {{ submitText }}
      </v-chip>
    </div>
  </div>
</template>

<style scoped>
.face { display: flex; flex-direction: column; gap: 12px; }
.face__instruction { display: flex; align-items: center; gap: 8px; min-height: 32px; }
.face__viewport { position: relative; aspect-ratio: 3 / 4; max-height: 60vh; background: var(--nt-bg); border: 1px solid var(--nt-border); border-radius: var(--nt-radius-md); overflow: hidden; }
.face__video { width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1); }
.face__oval { position: absolute; top: 12%; left: 20%; width: 60%; height: 70%; border: 3px dashed rgb(248 250 252 / 70%); border-radius: 50%; box-shadow: 0 0 0 9999px rgb(15 23 42 / 45%); pointer-events: none; transition: border-color 150ms ease; }
.face__oval--ready { border-color: var(--nt-accent); border-style: solid; }
.face__hint-icon { position: absolute; top: 8%; left: calc(50% - 26px); filter: drop-shadow(0 2px 6px rgb(0 0 0 / 70%)); }
.face__overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 12px; padding: 16px; text-align: center; background: rgb(15 23 42 / 70%); }
.face__progress { display: flex; flex-direction: column; gap: 6px; }
.face__actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }

/* Responsive: prueba de vida visible también en pantallas bajas. */
.face {
  inline-size: 100%;
  min-inline-size: 0;
  gap: clamp(8px, 1.2vh, 12px);
}
.face__instruction,
.face__progress,
.face__actions {
  inline-size: min(100%, 560px);
  min-inline-size: 0;
  margin-inline: auto;
}
.face__instruction {
  flex-wrap: wrap;
  align-items: center;
  overflow-wrap: anywhere;
}
.face__viewport {
  inline-size: min(100%, 350px, 39dvh);
  max-inline-size: 100%;
  max-block-size: 52dvh;
  block-size: auto;
  margin-inline: auto;
  flex: none;
}
.face__video {
  position: absolute;
  inset: 0;
}
.face__actions { flex-wrap: wrap; }
@media (max-height: 560px) {
  .face__viewport { inline-size: min(100%, 320px, 36dvh); }
  .face__hint-icon { top: 4%; }
}
@media (max-width: 380px) {
  .face__oval { border-width: 2px; }
  .face__instruction { gap: 6px; }
}
</style>
