<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import type { CameraFacing } from '~/composables/useCamera'

const props = withDefaults(defineProps<{
  facing?: CameraFacing
  confirmText?: string
}>(), {
  facing: 'user',
  confirmText: 'Usar foto'
})

const emit = defineEmits<{
  capture: [blob: Blob]
  cancel: []
}>()

const videoEl = ref<HTMLVideoElement | null>(null)
const camera = useCamera(props.facing)
const photo = ref<Blob | null>(null)
const photoUrl = ref<string | null>(null)

const mirrored = computed(() => camera.facing.value === 'user')

function clearPhoto(): void {
  if (photoUrl.value) URL.revokeObjectURL(photoUrl.value)
  photoUrl.value = null
  photo.value = null
}

async function open(): Promise<void> {
  clearPhoto()
  await camera.start(videoEl.value)
}

async function shoot(): Promise<void> {
  const blob = await camera.capture()
  if (!blob) return
  photo.value = blob
  photoUrl.value = URL.createObjectURL(blob)
  camera.stop()
}

function confirm(): void {
  if (photo.value) emit('capture', photo.value)
  clearPhoto()
}

function cancel(): void {
  camera.stop()
  clearPhoto()
  emit('cancel')
}

onBeforeUnmount(clearPhoto)
</script>

<template>
  <div class="camera">
    <div class="camera__viewport">
      <video
        v-show="!photoUrl"
        ref="videoEl"
        class="camera__video"
        :class="{ 'camera__video--mirror': mirrored }"
        autoplay
        muted
        playsinline
        aria-label="Vista previa de la cámara"
      />
      <img
        v-if="photoUrl"
        :src="photoUrl"
        class="camera__video"
        alt="Foto capturada"
      >

      <div
        v-if="!camera.isActive.value && !photoUrl"
        class="camera__overlay"
      >
        <template v-if="camera.error.value">
          <v-icon
            icon="mdi-camera-off-outline"
            size="40"
            color="error"
          />
          <p class="text-body-2 text-center">
            {{ camera.error.value.message }}
          </p>
        </template>
        <v-btn
          color="primary"
          prepend-icon="mdi-camera"
          :loading="camera.isStarting.value"
          @click="open"
        >
          {{ camera.error.value ? 'Reintentar' : 'Activar cámara' }}
        </v-btn>
      </div>
    </div>

    <div class="camera__actions">
      <v-btn
        variant="text"
        @click="cancel"
      >
        Cancelar
      </v-btn>
      <v-spacer />
      <template v-if="photoUrl">
        <v-btn
          variant="tonal"
          prepend-icon="mdi-refresh"
          @click="open"
        >
          Repetir
        </v-btn>
        <v-btn
          color="primary"
          prepend-icon="mdi-check"
          @click="confirm"
        >
          {{ confirmText }}
        </v-btn>
      </template>
      <template v-else-if="camera.isActive.value">
        <v-btn
          v-if="camera.hasMultipleCameras.value"
          icon="mdi-camera-flip-outline"
          variant="tonal"
          aria-label="Cambiar cámara"
          @click="camera.switchCamera()"
        />
        <v-btn
          color="primary"
          prepend-icon="mdi-camera-iris"
          @click="shoot"
        >
          Tomar foto
        </v-btn>
      </template>
    </div>
  </div>
</template>

<style scoped>
.camera {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.camera__viewport {
  position: relative;
  aspect-ratio: 1;
  background: var(--nt-bg);
  border: 1px solid var(--nt-border);
  border-radius: var(--nt-radius-md);
  overflow: hidden;
}

.camera__video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.camera__video--mirror {
  transform: scaleX(-1);
}

.camera__overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 16px;
}

.camera__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
