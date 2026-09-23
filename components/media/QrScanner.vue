<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { QrValidationResult } from '~/composables/useQrScanner'

const props = withDefaults(defineProps<{
  /** Validación en backend (o mock). Si no se pasa, cualquier código es válido. */
  validate?: (code: string) => Promise<QrValidationResult>
  title?: string
  autoStart?: boolean
}>(), {
  validate: undefined,
  title: 'Escanea el código QR',
  autoStart: true
})

const emit = defineEmits<{ valid: [code: string] }>()

const videoEl = ref<HTMLVideoElement | null>(null)
const scanner = useQrScanner()
const manualCode = ref('')
const showManual = ref(false)
const validating = ref(false)
const feedback = ref<{ type: 'success' | 'error', text: string } | null>(null)

const statusText = computed(() => {
  switch (scanner.status.value) {
    case 'starting': return 'Iniciando cámara…'
    case 'scanning': return 'Apunta al código QR'
    case 'detected': return validating.value ? 'Validando…' : 'Código detectado'
    case 'error': return scanner.error.value ?? 'Error'
    default: return 'Cámara apagada'
  }
})

async function handleCode(code: string): Promise<void> {
  validating.value = true
  feedback.value = null
  try {
    const result = props.validate ? await props.validate(code) : { ok: true }
    if (result.ok) {
      feedback.value = { type: 'success', text: result.message ?? 'Código válido' }
      scanner.stop()
      emit('valid', code)
    }
    else {
      feedback.value = { type: 'error', text: result.message ?? 'Código no válido' }
      scanner.resume()
    }
  }
  catch {
    feedback.value = { type: 'error', text: 'No se pudo validar el código. Inténtalo de nuevo.' }
    scanner.resume()
  }
  finally {
    validating.value = false
  }
}

async function startScan(): Promise<void> {
  feedback.value = null
  if (videoEl.value) await scanner.start(videoEl.value, handleCode)
  if (scanner.status.value === 'error') showManual.value = true
}

function submitManual(): void {
  const code = manualCode.value.trim()
  if (code) void handleCode(code)
}

onMounted(() => {
  if (props.autoStart) void startScan()
})
</script>

<template>
  <div class="qr">
    <div class="d-flex align-center mb-3">
      <h3 class="text-subtitle-1 font-weight-semibold">
        {{ title }}
      </h3>
      <v-spacer />
      <v-chip
        size="small"
        variant="tonal"
        :color="scanner.status.value === 'error' ? 'error' : scanner.status.value === 'scanning' ? 'accent' : undefined"
      >
        {{ statusText }}
      </v-chip>
    </div>

    <div class="qr__viewport">
      <video
        ref="videoEl"
        class="qr__video"
        muted
        playsinline
        aria-label="Lector de código QR"
      />
      <div
        v-if="scanner.status.value === 'scanning'"
        class="qr__frame"
        aria-hidden="true"
      />
      <div
        v-if="scanner.status.value === 'idle' || scanner.status.value === 'error'"
        class="qr__overlay"
      >
        <v-btn
          color="primary"
          prepend-icon="mdi-qrcode-scan"
          @click="startScan"
        >
          {{ scanner.status.value === 'error' ? 'Reintentar' : 'Escanear' }}
        </v-btn>
      </div>
    </div>

    <v-alert
      v-if="feedback"
      :type="feedback.type"
      variant="tonal"
      density="compact"
      class="mt-3"
      role="status"
    >
      {{ feedback.text }}
    </v-alert>

    <v-btn
      variant="text"
      size="small"
      class="mt-2"
      :prepend-icon="showManual ? 'mdi-chevron-up' : 'mdi-keyboard-outline'"
      @click="showManual = !showManual"
    >
      Ingresar código manualmente
    </v-btn>

    <form
      v-if="showManual"
      class="d-flex ga-2 mt-2"
      @submit.prevent="submitManual"
    >
      <v-text-field
        v-model="manualCode"
        label="Código"
        density="compact"
        hide-details
        autocomplete="off"
      />
      <v-btn
        type="submit"
        color="primary"
        :loading="validating"
        :disabled="!manualCode.trim()"
      >
        Validar
      </v-btn>
    </form>
  </div>
</template>

<style scoped>
.qr__viewport {
  position: relative;
  aspect-ratio: 1;
  max-width: 420px;
  background: var(--nt-bg);
  border: 1px solid var(--nt-border);
  border-radius: var(--nt-radius-md);
  overflow: hidden;
}

.qr__video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.qr__frame {
  position: absolute;
  inset: 18%;
  border: 3px solid var(--nt-accent);
  border-radius: var(--nt-radius-md);
  box-shadow: 0 0 0 9999px rgb(15 23 42 / 55%);
}

.qr__overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
