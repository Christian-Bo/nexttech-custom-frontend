<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import type { FaceLandmarker } from '@mediapipe/tasks-vision'
import type { CameraFacing } from '~/composables/useCamera'

const props = withDefaults(defineProps<{
  facing?: CameraFacing
}>(), { facing: 'user' })

const emit = defineEmits<{
  capture: [blob: Blob]
  cancel: []
}>()

const videoEl = ref<HTMLVideoElement | null>(null)
const camera = useCamera(props.facing)
const progress = ref(0)
const statusText = ref('Preparando la cámara…')
const loadingDetector = ref(false)
const scanning = ref(false)
const capturing = ref(false)
const errorText = ref<string | null>(null)
const mirrored = computed(() => camera.facing.value === 'user')

const HOLD_MS = 1500
const FRAME_INTERVAL_MS = 170
let landmarker: FaceLandmarker | null = null
let animationFrame: number | null = null
let lastAnalyzedAt = 0
let stableSince = 0
let lastCenter: { x: number, y: number } | null = null
let running = false
let disposed = false
let session = 0

function stopScanning(): void {
  running = false
  scanning.value = false
  if (animationFrame !== null) cancelAnimationFrame(animationFrame)
  animationFrame = null
}

function resetDetection(): void {
  stableSince = 0
  lastCenter = null
  progress.value = 0
}

async function loadLandmarker(): Promise<boolean> {
  if (landmarker) return true
  loadingDetector.value = true
  try {
    const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision')
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.0/wasm'
    )
    const created = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
        delegate: 'CPU'
      },
      runningMode: 'VIDEO',
      numFaces: 2,
      minFaceDetectionConfidence: 0.65,
      minFacePresenceConfidence: 0.65,
      minTrackingConfidence: 0.65
    })
    if (disposed) {
      created.close()
      return false
    }
    landmarker = created
    return true
  }
  catch (e) {
    console.error('[camera] No se pudo cargar MediaPipe:', e)
    errorText.value = 'No se pudo cargar el detector facial. Revisa tu conexión e inténtalo de nuevo.'
    return false
  }
  finally {
    loadingDetector.value = false
  }
}

async function takeAutomaticPhoto(currentSession: number): Promise<void> {
  if (capturing.value) return
  capturing.value = true
  stopScanning()
  statusText.value = 'Capturando fotografía…'
  try {
    const blob = await camera.capture(0.9)
    if (disposed || currentSession !== session) return
    camera.stop()
    if (!blob) {
      resetDetection()
      errorText.value = 'No se pudo capturar la imagen. Intenta nuevamente.'
      return
    }
    progress.value = 100
    statusText.value = 'Fotografía capturada. Preparando el editor…'
    emit('capture', blob)
  }
  catch (e) {
    console.error('[camera] No se pudo capturar:', e)
    if (!disposed && currentSession === session) {
      camera.stop()
      errorText.value = 'Ocurrió un error al capturar la fotografía. Intenta nuevamente.'
    }
  }
  finally {
    capturing.value = false
  }
}

function analyze(currentSession: number, now: number): void {
  if (!running || disposed || currentSession !== session) return
  animationFrame = requestAnimationFrame(time => analyze(currentSession, time))
  if (now - lastAnalyzedAt < FRAME_INTERVAL_MS) return
  lastAnalyzedAt = now

  const video = videoEl.value
  if (!landmarker || !camera.isActive.value || !video || video.readyState < 2 || !video.videoWidth) return

  try {
    const faces = landmarker.detectForVideo(video, now).faceLandmarks
    if (faces.length !== 1) {
      resetDetection()
      statusText.value = faces.length > 1
        ? 'Solo debe aparecer una persona frente a la cámara.'
        : 'Coloca tu rostro dentro del marco.'
      return
    }

    const points = faces[0]!
    const xs = points.map(point => point.x)
    const ys = points.map(point => point.y)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    const center = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 }
    const width = maxX - minX
    const height = maxY - minY

    const framed = Math.abs(center.x - 0.5) < 0.15
      && Math.abs(center.y - 0.5) < 0.17
      && width > 0.22 && width < 0.76
      && height > 0.26 && height < 0.84

    if (!framed) {
      resetDetection()
      statusText.value = 'Centra tu rostro y ajusta la distancia.'
      return
    }

    const steady = !lastCenter || Math.hypot(
      center.x - lastCenter.x,
      center.y - lastCenter.y
    ) < 0.022
    lastCenter = center
    if (!steady) stableSince = 0
    if (stableSince === 0) stableSince = now

    progress.value = Math.min(100, Math.round((now - stableSince) * 100 / HOLD_MS))
    statusText.value = steady
      ? 'Rostro detectado. Mantente quieto unos instantes.'
      : 'Mantén tu rostro estable para tomar la foto.'

    if (progress.value === 100) void takeAutomaticPhoto(currentSession)
  }
  catch (e) {
    console.error('[camera] Error al detectar el rostro:', e)
    stopScanning()
    errorText.value = 'No se pudo analizar la cámara. Intenta nuevamente.'
  }
}

async function open(): Promise<void> {
  const currentSession = ++session
  stopScanning()
  camera.stop()
  resetDetection()
  capturing.value = false
  errorText.value = null
  statusText.value = 'Preparando la cámara…'

  await nextTick()
  if (disposed || currentSession !== session) return
  const started = await camera.start(videoEl.value)
  if (disposed || currentSession !== session) {
    camera.stop()
    return
  }
  if (!started) return

  statusText.value = 'Cargando detector facial…'
  const ready = await loadLandmarker()
  if (disposed || currentSession !== session || !ready) {
    camera.stop()
    return
  }

  lastAnalyzedAt = 0
  running = true
  scanning.value = true
  statusText.value = 'Coloca tu rostro dentro del marco.'
  animationFrame = requestAnimationFrame(time => analyze(currentSession, time))
}

function cancel(): void {
  session++
  stopScanning()
  camera.stop()
  emit('cancel')
}

async function switchCamera(): Promise<void> {
  const currentSession = ++session
  stopScanning()
  resetDetection()
  await camera.switchCamera()
  if (disposed || currentSession !== session || !camera.isActive.value) return
  lastAnalyzedAt = 0
  running = true
  scanning.value = true
  statusText.value = 'Coloca tu rostro dentro del marco.'
  animationFrame = requestAnimationFrame(time => analyze(currentSession, time))
}

onMounted(() => { void open() })
onBeforeUnmount(() => {
  disposed = true
  session++
  stopScanning()
  camera.stop()
  landmarker?.close()
  landmarker = null
})
</script>

<template>
  <div class="camera">
    <div class="camera__viewport">
      <video
        ref="videoEl"
        class="camera__video"
        :class="{ 'camera__video--mirror': mirrored }"
        autoplay
        muted
        playsinline
        aria-label="Vista previa de la cámara"
      />
      <div class="camera__oval" :class="{ 'camera__oval--ready': progress > 0 }" aria-hidden="true" />

      <div v-if="!camera.isActive.value || loadingDetector" class="camera__overlay">
        <v-progress-circular
          v-if="camera.isStarting.value || loadingDetector || capturing"
          indeterminate
          color="accent"
        />
        <template v-else>
          <v-icon
            icon="mdi-camera-off-outline"
            size="40"
            :color="camera.error.value || errorText ? 'error' : 'accent'"
          />
          <p class="text-body-2 text-center">
            {{ camera.error.value?.message || errorText || 'No fue posible iniciar la cámara automáticamente.' }}
          </p>
          <v-btn color="primary" prepend-icon="mdi-refresh" @click="open">Reintentar</v-btn>
        </template>
      </div>
    </div>

    <div class="camera__detection" role="status" aria-live="polite">
      <span class="text-body-2 text-medium-emphasis">{{ errorText || statusText }}</span>
      <v-progress-linear :model-value="progress" color="accent" height="8" rounded />
      <span class="text-caption text-medium-emphasis">
        {{ scanning ? `Detección: ${progress}%` : 'Captura automática' }}
      </span>
    </div>

    <div class="camera__actions">
      <v-btn variant="text" @click="cancel">Cancelar</v-btn>
      <v-spacer />
      <v-btn
        v-if="camera.isActive.value && camera.hasMultipleCameras.value && !capturing"
        icon="mdi-camera-flip-outline"
        variant="tonal"
        aria-label="Cambiar cámara"
        @click="switchCamera"
      />
      <v-btn v-if="errorText && camera.isActive.value" variant="tonal" @click="open">Reintentar</v-btn>
    </div>
  </div>
</template>

<style scoped>
.camera { display: flex; flex-direction: column; gap: 12px; }
.camera__viewport { position: relative; aspect-ratio: 1; background: var(--nt-bg); border: 1px solid var(--nt-border); border-radius: var(--nt-radius-md); overflow: hidden; }
.camera__video { width: 100%; height: 100%; object-fit: cover; }
.camera__video--mirror { transform: scaleX(-1); }
.camera__oval { position: absolute; top: 13%; left: 21%; width: 58%; height: 74%; border: 3px dashed rgb(248 250 252 / 70%); border-radius: 50%; box-shadow: 0 0 0 9999px rgb(15 23 42 / 25%); pointer-events: none; }
.camera__oval--ready { border-color: var(--nt-accent); border-style: solid; }
.camera__overlay { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 16px; background: rgb(15 23 42 / 70%); }
.camera__detection { display: flex; flex-direction: column; gap: 6px; }
.camera__actions { display: flex; align-items: center; gap: 8px; }

/* Responsive: vista contenida, sin cambiar captura ni detección. */
.camera {
  inline-size: 100%;
  min-inline-size: 0;
  gap: clamp(8px, 1.2vh, 12px);
}
.camera__viewport {
  inline-size: min(100%, 360px, 48dvh);
  max-inline-size: 100%;
  block-size: auto;
  margin-inline: auto;
  flex: none;
}
.camera__video {
  position: absolute;
  inset: 0;
}
.camera__detection,
.camera__actions {
  inline-size: min(100%, 450px);
  min-inline-size: 0;
  margin-inline: auto;
}
.camera__detection > span {
  overflow-wrap: anywhere;
}
.camera__actions { flex-wrap: wrap; }
.camera__overlay { text-align: center; }
@media (max-height: 560px) {
  .camera__viewport { inline-size: min(100%, 320px, 42dvh); }
}
@media (max-width: 380px) {
  .camera__actions { gap: 6px; }
  .camera__oval { border-width: 2px; }
}
</style>
