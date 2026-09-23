<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { FaceCaptureDto, FaceChallengeDto } from '~/types/auth'
import { FACE_MAX_IMAGE_BYTES } from '~/types/auth'

/**
 * Captura facial guiada para prueba de vida (liveness):
 * 1) foto frontal  2) foto cumpliendo el reto (cuenta 3-2-1)  3) revisar y enviar.
 * Un reto nuevo por intento: el padre lo pide con `request-challenge`.
 */
const props = withDefaults(defineProps<{
  challenge: FaceChallengeDto | null
  /** Cargando reto o enviando fotos. */
  busy?: boolean
  submitText?: string
}>(), {
  busy: false,
  submitText: 'Verificar'
})

const emit = defineEmits<{
  'submit': [capture: FaceCaptureDto]
  'request-challenge': []
  'cancel': []
}>()

/** La vista previa es espejo (como selfie). Si en pruebas reales la flecha sale invertida, cambiar a false. */
const PREVIEW_IS_MIRRORED = true

type Step = 'neutral' | 'challenge' | 'review'

const videoEl = ref<HTMLVideoElement | null>(null)
const camera = useCamera('user')
const step = ref<Step>('neutral')
const neutral = ref<Blob | null>(null)
const challengeShot = ref<Blob | null>(null)
const neutralUrl = ref<string | null>(null)
const challengeUrl = ref<string | null>(null)
const countdown = ref(0)
const remaining = ref(0)
const sizeError = ref<string | null>(null)

let countdownTimer: ReturnType<typeof setInterval> | null = null
let expiryTimer: ReturnType<typeof setInterval> | null = null

const expired = computed(() => !!props.challenge && remaining.value <= 0)

/** Pista visual del reto según el código de acción del backend. */
const hint = computed(() => {
  const action = (props.challenge?.action ?? '').toUpperCase()
  if (action.includes('BLINK')) return { icon: 'mdi-eye-outline', text: 'Parpadea' }
  if (action.includes('SMILE')) return { icon: 'mdi-emoticon-happy-outline', text: 'Sonríe' }
  if (action.includes('UP')) return { icon: 'mdi-arrow-up-bold', text: 'Mira hacia arriba' }
  if (action.includes('DOWN')) return { icon: 'mdi-arrow-down-bold', text: 'Mira hacia abajo' }
  const imageLeft = action.includes('LEFT')
  const imageRight = action.includes('RIGHT')
  if (!imageLeft && !imageRight) return null
  // "IMAGE_LEFT" = en la foto (sin espejo) la cara apunta a la izquierda = derecha del usuario.
  const screenRight = PREVIEW_IS_MIRRORED ? imageLeft : imageRight
  return {
    icon: screenRight ? 'mdi-arrow-right-bold' : 'mdi-arrow-left-bold',
    text: `Gira la cabeza hacia tu ${imageLeft ? 'derecha' : 'izquierda'}`
  }
})

function revoke(): void {
  if (neutralUrl.value) URL.revokeObjectURL(neutralUrl.value)
  if (challengeUrl.value) URL.revokeObjectURL(challengeUrl.value)
  neutralUrl.value = null
  challengeUrl.value = null
}

function stopCountdown(): void {
  if (countdownTimer) clearInterval(countdownTimer)
  countdownTimer = null
  countdown.value = 0
}

function reset(): void {
  stopCountdown()
  revoke()
  neutral.value = null
  challengeShot.value = null
  sizeError.value = null
  step.value = 'neutral'
}

async function ensureCamera(): Promise<void> {
  if (!camera.isActive.value) await camera.start(videoEl.value)
}

async function shoot(): Promise<Blob | null> {
  const blob = await camera.capture(0.9)
  if (blob && blob.size > FACE_MAX_IMAGE_BYTES) {
    sizeError.value = 'La foto es demasiado grande. Aléjate un poco de la cámara e inténtalo de nuevo.'
    return null
  }
  sizeError.value = null
  return blob
}

async function takeNeutral(): Promise<void> {
  const blob = await shoot()
  if (!blob) return
  neutral.value = blob
  neutralUrl.value = URL.createObjectURL(blob)
  step.value = 'challenge'
}

function takeChallenge(): void {
  stopCountdown()
  countdown.value = 3
  countdownTimer = setInterval(async () => {
    countdown.value--
    if (countdown.value > 0) return
    stopCountdown()
    const blob = await shoot()
    if (!blob) return
    challengeShot.value = blob
    challengeUrl.value = URL.createObjectURL(blob)
    step.value = 'review'
    camera.stop()
  }, 1000)
}

async function retake(): Promise<void> {
  reset()
  await ensureCamera()
}

function submit(): void {
  if (!neutral.value || !challengeShot.value) return
  if (expired.value) {
    emit('request-challenge')
    return
  }
  emit('submit', { neutralImage: neutral.value, challengeImage: challengeShot.value })
}

function tickExpiry(): void {
  const c = props.challenge
  remaining.value = c ? Math.max(0, Math.round((Date.parse(c.expiresAtUtc) - Date.now()) / 1000)) : 0
  // Si el reloj del cliente difiere del servidor, usamos expiresInSeconds como respaldo.
  if (c && Number.isNaN(Date.parse(c.expiresAtUtc))) remaining.value = c.expiresInSeconds
}

// Reto nuevo => empezar de cero (no se reutilizan fotos de otro reto).
watch(() => props.challenge?.id, async (id, old) => {
  tickExpiry()
  if (id && id !== old) await retake()
})

onMounted(async () => {
  tickExpiry()
  expiryTimer = setInterval(tickExpiry, 1000)
  if (props.challenge) await ensureCamera()
})

onBeforeUnmount(() => {
  stopCountdown()
  if (expiryTimer) clearInterval(expiryTimer)
  revoke()
})
</script>

<template>
  <div class="face">
    <!-- Instrucción del paso -->
    <div class="face__instruction">
      <template v-if="!challenge">
        <span class="text-medium-emphasis">Preparando la verificación…</span>
      </template>
      <template v-else-if="step === 'neutral'">
        <v-icon icon="mdi-account-outline" />
        <span><strong>Paso 1 de 2:</strong> mira de frente a la cámara</span>
      </template>
      <template v-else-if="step === 'challenge'">
        <v-icon
          v-if="hint"
          :icon="hint.icon"
          color="accent"
        />
        <span><strong>Paso 2 de 2:</strong> {{ challenge.instruction || hint?.text }}</span>
      </template>
      <template v-else>
        <v-icon
          icon="mdi-check-circle-outline"
          color="success"
        />
        <span>Revisa tus fotos y envíalas</span>
      </template>
      <v-spacer />
      <v-chip
        v-if="challenge"
        size="small"
        variant="tonal"
        :color="expired ? 'error' : remaining <= 15 ? 'warning' : undefined"
        prepend-icon="mdi-timer-outline"
      >
        {{ expired ? 'Expirado' : `${remaining}s` }}
      </v-chip>
    </div>

    <!-- Cámara -->
    <div
      v-show="step !== 'review'"
      class="face__viewport"
    >
      <video
        ref="videoEl"
        class="face__video"
        :class="{ 'face__video--mirror': PREVIEW_IS_MIRRORED }"
        muted
        playsinline
        aria-label="Vista previa de la cámara"
      />
      <div
        class="face__oval"
        :class="{ 'face__oval--active': step === 'challenge' }"
        aria-hidden="true"
      />
      <div
        v-if="step === 'challenge' && hint && countdown === 0"
        class="face__arrow"
        aria-hidden="true"
      >
        <v-icon
          :icon="hint.icon"
          size="56"
        />
      </div>
      <div
        v-if="countdown > 0"
        class="face__countdown"
        role="status"
      >
        {{ countdown }}
      </div>
      <div
        v-if="!camera.isActive.value && challenge"
        class="face__overlay"
      >
        <p
          v-if="camera.error.value"
          class="text-body-2 text-center mb-3"
        >
          {{ camera.error.value.message }}
        </p>
        <v-btn
          color="primary"
          prepend-icon="mdi-camera"
          :loading="camera.isStarting.value"
          @click="ensureCamera"
        >
          Activar cámara
        </v-btn>
      </div>
    </div>

    <!-- Revisión -->
    <div
      v-if="step === 'review'"
      class="face__review"
    >
      <figure>
        <img
          :src="neutralUrl ?? ''"
          alt="Foto de frente"
        >
        <figcaption>De frente</figcaption>
      </figure>
      <figure>
        <img
          :src="challengeUrl ?? ''"
          alt="Foto del reto"
        >
        <figcaption>{{ hint?.text ?? 'Reto' }}</figcaption>
      </figure>
    </div>

    <v-alert
      v-if="sizeError"
      type="warning"
      variant="tonal"
      density="compact"
    >
      {{ sizeError }}
    </v-alert>

    <v-alert
      v-if="expired"
      type="warning"
      variant="tonal"
      density="compact"
    >
      El tiempo para esta verificación terminó. Pide un reto nuevo.
    </v-alert>

    <!-- Acciones -->
    <div class="face__actions">
      <v-btn
        variant="text"
        @click="emit('cancel')"
      >
        Cancelar
      </v-btn>
      <v-spacer />
      <v-btn
        v-if="expired"
        color="primary"
        prepend-icon="mdi-refresh"
        :loading="busy"
        @click="emit('request-challenge')"
      >
        Nuevo reto
      </v-btn>
      <template v-else-if="step === 'neutral'">
        <v-btn
          color="primary"
          prepend-icon="mdi-camera-iris"
          :disabled="!camera.isActive.value || busy"
          @click="takeNeutral"
        >
          Tomar foto
        </v-btn>
      </template>
      <template v-else-if="step === 'challenge'">
        <v-btn
          variant="tonal"
          @click="retake"
        >
          Volver
        </v-btn>
        <v-btn
          color="primary"
          prepend-icon="mdi-timer-3"
          :disabled="countdown > 0 || !camera.isActive.value"
          @click="takeChallenge"
        >
          Estoy listo
        </v-btn>
      </template>
      <template v-else>
        <v-btn
          variant="tonal"
          prepend-icon="mdi-refresh"
          :disabled="busy"
          @click="retake"
        >
          Repetir
        </v-btn>
        <v-btn
          color="primary"
          prepend-icon="mdi-shield-check-outline"
          :loading="busy"
          @click="submit"
        >
          {{ submitText }}
        </v-btn>
      </template>
    </div>
  </div>
</template>

<style scoped>
.face {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.face__instruction {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;
}

.face__viewport {
  position: relative;
  aspect-ratio: 3 / 4;
  max-height: 60vh;
  background: var(--nt-bg);
  border: 1px solid var(--nt-border);
  border-radius: var(--nt-radius-md);
  overflow: hidden;
}

.face__video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.face__video--mirror {
  transform: scaleX(-1);
}

.face__oval {
  position: absolute;
  top: 12%;
  left: 20%;
  width: 60%;
  height: 70%;
  border: 3px dashed rgb(248 250 252 / 70%);
  border-radius: 50%;
  box-shadow: 0 0 0 9999px rgb(15 23 42 / 45%);
  pointer-events: none;
  transition: border-color var(--nt-transition-base);
}

.face__oval--active {
  border-color: var(--nt-accent);
  border-style: solid;
}

.face__arrow {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: var(--nt-accent);
  animation: nudge 1.2s ease-in-out infinite;
  pointer-events: none;
}

.face__countdown {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-size: 6rem;
  font-weight: 700;
  color: var(--nt-text);
  text-shadow: 0 4px 24px rgb(0 0 0 / 60%);
}

.face__overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgb(15 23 42 / 70%);
}

.face__review {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.face__review img {
  width: 100%;
  aspect-ratio: 3 / 4;
  object-fit: cover;
  border-radius: var(--nt-radius-md);
  border: 1px solid var(--nt-border);
}

.face__review figcaption {
  margin-top: 4px;
  font-size: 0.8rem;
  color: var(--nt-text-muted);
  text-align: center;
}

.face__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

@keyframes nudge {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
}
</style>
