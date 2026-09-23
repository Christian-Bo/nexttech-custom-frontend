<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import {
  MAX_PORTRAIT_STICKERS,
  MAX_ZOOM,
  MIN_ZOOM,
  PORTRAIT_BACKGROUNDS,
  PORTRAIT_FILTERS,
  PORTRAIT_HEIGHT,
  PORTRAIT_STICKERS,
  PORTRAIT_WIDTH,
  addSticker,
  computeSourceRect,
  createPortraitState,
  drawPortrait,
  hitSticker,
  moveSticker,
  panFromDrag,
  removeSticker,
  resizeSticker
} from '../utils/portrait'
import type { PortraitState } from '../utils/portrait'
import { blobToDataUrl } from '../services/portraitStorage'
import { ImageValidationError, processImage } from '~/utils/image'
import { isApiError } from '~/services/api'
import { useFaceService } from '~/services/faceService'

/**
 * Estudio de foto: tomar/subir foto -> recortar el rostro -> filtros y stickers -> guardar.
 * Emite la foto original y la modificada como data URL (JPEG).
 */
const emit = defineEmits<{ saved: [value: { original: string, modified: string, state: PortraitState }] }>()

const snackbar = useSnackbar()
const auth = useAuthStore()
const faceService = useFaceService()
const useMocks = !!useRuntimeConfig().public.useMocks

type Step = 'source' | 'camera' | 'edit'
const step = ref<Step>('source')
const fileInput = ref<HTMLInputElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)

const originalBlob = shallowRef<Blob | null>(null)
// shallowRef: el canvas necesita el objeto real, no un proxy reactivo.
const originalImage = shallowRef<ImageBitmap | null>(null)
/** Imagen con la que se trabaja: la original o la recortada por Face API (fondo transparente). */
const workingImage = shallowRef<ImageBitmap | null>(null)
const segmented = ref(false)

const state = ref<PortraitState>(createPortraitState())
const selectedId = ref<number | null>(null)
const showOriginal = ref(false)
const loadingPhoto = ref(false)
const segmenting = ref(false)
const saving = ref(false)

const selected = computed(() => state.value.stickers.find(s => s.id === selectedId.value) ?? null)
const canSegment = computed(() => !useMocks && auth.isBuyer && !segmented.value)
const stickersLeft = computed(() => MAX_PORTRAIT_STICKERS - state.value.stickers.length)

// ---------- Cargar foto ----------

async function useBlob(blob: Blob): Promise<void> {
  loadingPhoto.value = true
  try {
    const processed = await processImage(blob, { maxSide: 1600, quality: 0.9 })
    const bitmap = await createImageBitmap(processed)
    originalImage.value?.close()
    if (workingImage.value !== originalImage.value) workingImage.value?.close()
    originalBlob.value = processed
    originalImage.value = bitmap
    workingImage.value = bitmap
    segmented.value = false
    state.value = { ...createPortraitState(), filter: state.value.filter }
    selectedId.value = null
    step.value = 'edit'
  }
  catch (e) {
    snackbar.error(e instanceof ImageValidationError ? e.message : 'No se pudo abrir la foto.')
  }
  finally {
    loadingPhoto.value = false
  }
}

function pickFile(): void {
  fileInput.value?.click()
}

async function onFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) await useBlob(file)
}

// ---------- Recorte automático (Face API) ----------

async function segmentFace(): Promise<void> {
  if (!originalBlob.value) return
  segmenting.value = true
  try {
    const blob = await faceService.segmentCard(originalBlob.value)
    const bitmap = await createImageBitmap(blob)
    if (workingImage.value && workingImage.value !== originalImage.value) workingImage.value.close()
    workingImage.value = bitmap
    segmented.value = true
    state.value = { ...state.value, zoom: 1, panX: 0, panY: 0 }
    snackbar.success('Listo, recortamos tu rostro. Elige un color de fondo.')
  }
  catch (e) {
    snackbar.error(isApiError(e) ? e : 'No se pudo recortar la foto automáticamente.')
  }
  finally {
    segmenting.value = false
  }
}

function undoSegment(): void {
  if (workingImage.value && workingImage.value !== originalImage.value) workingImage.value.close()
  workingImage.value = originalImage.value
  segmented.value = false
}

// ---------- Dibujo ----------

let frame = 0
function render(): void {
  cancelAnimationFrame(frame)
  frame = requestAnimationFrame(() => {
    const el = canvas.value
    const img = showOriginal.value ? originalImage.value : workingImage.value
    const ctx = el?.getContext('2d')
    if (!el || !img || !ctx) return
    const view: PortraitState = showOriginal.value
      ? { ...createPortraitState(), zoom: 1, panX: 0, panY: 0 }
      : state.value
    drawPortrait(ctx, img, view)
    if (showOriginal.value) return

    // Guía del rostro (solo en pantalla, no se guarda).
    ctx.save()
    ctx.setLineDash([10, 8])
    ctx.lineWidth = 3
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.75)'
    ctx.beginPath()
    ctx.ellipse(PORTRAIT_WIDTH / 2, PORTRAIT_HEIGHT * 0.42, PORTRAIT_WIDTH * 0.27, PORTRAIT_HEIGHT * 0.25, 0, 0, Math.PI * 2)
    ctx.stroke()
    const s = selected.value
    if (s) {
      const size = s.size * PORTRAIT_WIDTH
      ctx.setLineDash([6, 6])
      ctx.strokeStyle = '#FFFFFF'
      ctx.strokeRect(s.x * PORTRAIT_WIDTH - size / 2, s.y * PORTRAIT_HEIGHT - size / 2, size, size)
    }
    ctx.restore()
  })
}

watch([state, selectedId, showOriginal, workingImage], render, { deep: true })
watch(step, async (value) => {
  if (value !== 'edit') return
  await nextTick()
  render()
})

// ---------- Arrastrar (foto o sticker) ----------

type Drag = { kind: 'pan', startX: number, startY: number, panX: number, panY: number } | { kind: 'sticker', id: number }
let drag: Drag | null = null

function pointToNormalized(event: PointerEvent): { x: number, y: number } {
  const rect = canvas.value!.getBoundingClientRect()
  return { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height }
}

function onPointerDown(event: PointerEvent): void {
  if (!canvas.value || showOriginal.value) return
  canvas.value.setPointerCapture(event.pointerId)
  const p = pointToNormalized(event)
  const hit = hitSticker(state.value.stickers, p.x, p.y)
  if (hit) {
    selectedId.value = hit.id
    drag = { kind: 'sticker', id: hit.id }
    return
  }
  selectedId.value = null
  drag = { kind: 'pan', startX: event.clientX, startY: event.clientY, panX: state.value.panX, panY: state.value.panY }
}

function onPointerMove(event: PointerEvent): void {
  if (!drag || !canvas.value || !workingImage.value) return
  if (drag.kind === 'sticker') {
    const p = pointToNormalized(event)
    state.value.stickers = moveSticker(state.value.stickers, drag.id, p.x, p.y)
    return
  }
  const rect = canvas.value.getBoundingClientRect()
  const img = workingImage.value
  const src = computeSourceRect(img.width, img.height, state.value.zoom, drag.panX, drag.panY)
  const next = panFromDrag(
    { panX: drag.panX, panY: drag.panY },
    event.clientX - drag.startX,
    event.clientY - drag.startY,
    rect.width,
    rect.height,
    src,
    img.width,
    img.height
  )
  state.value.panX = next.panX
  state.value.panY = next.panY
}

function onPointerUp(): void {
  drag = null
}

function onWheel(event: WheelEvent): void {
  if (showOriginal.value) return
  const next = state.value.zoom - event.deltaY * 0.0015
  state.value.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next))
}

// ---------- Stickers ----------

function onAddSticker(emoji: string): void {
  const next = addSticker(state.value.stickers, emoji)
  if (!next) {
    snackbar.warning(`Puedes usar hasta ${MAX_PORTRAIT_STICKERS} stickers en tu foto.`)
    return
  }
  state.value.stickers = next
  selectedId.value = next[next.length - 1]!.id
}

function onResizeSelected(size: number): void {
  if (selectedId.value !== null) state.value.stickers = resizeSticker(state.value.stickers, selectedId.value, size)
}

function onRemoveSelected(): void {
  if (selectedId.value === null) return
  state.value.stickers = removeSticker(state.value.stickers, selectedId.value)
  selectedId.value = null
}

function resetCrop(): void {
  const fresh = createPortraitState()
  state.value.zoom = segmented.value ? 1 : fresh.zoom
  state.value.panX = 0
  state.value.panY = segmented.value ? 0 : fresh.panY
}

// ---------- Guardar ----------

function canvasToBlob(el: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    el.toBlob(b => (b ? resolve(b) : reject(new Error('No se pudo generar la imagen.'))), 'image/jpeg', 0.9)
  })
}

async function save(): Promise<void> {
  if (!workingImage.value || !originalBlob.value) return
  saving.value = true
  try {
    const out = document.createElement('canvas')
    out.width = PORTRAIT_WIDTH
    out.height = PORTRAIT_HEIGHT
    const ctx = out.getContext('2d')
    if (!ctx) throw new Error('Canvas no disponible')
    drawPortrait(ctx, workingImage.value, state.value)
    const modifiedBlob = await canvasToBlob(out)
    const originalSmall = await processImage(originalBlob.value, { maxSide: 1200, quality: 0.85 })
    const [original, modified] = await Promise.all([blobToDataUrl(originalSmall), blobToDataUrl(modifiedBlob)])
    emit('saved', { original, modified, state: JSON.parse(JSON.stringify(state.value)) as PortraitState })
  }
  catch {
    snackbar.error('No se pudo guardar tu foto. Intenta de nuevo.')
  }
  finally {
    saving.value = false
  }
}

onBeforeUnmount(() => {
  cancelAnimationFrame(frame)
  if (workingImage.value && workingImage.value !== originalImage.value) workingImage.value.close()
  originalImage.value?.close()
})
</script>

<template>
  <div class="studio">
    <input
      ref="fileInput"
      type="file"
      accept="image/jpeg,image/png,image/webp"
      class="d-none"
      @change="onFile"
    >

    <!-- 1. Elegir foto -->
    <div
      v-if="step === 'source'"
      class="studio__source"
    >
      <v-card
        class="studio__option"
        variant="outlined"
        :disabled="loadingPhoto"
        @click="step = 'camera'"
      >
        <v-icon
          icon="mdi-camera-outline"
          size="40"
          color="accent"
        />
        <div class="text-subtitle-1 font-weight-bold mt-3">
          Tomar una foto
        </div>
        <div class="text-body-2 text-medium-emphasis">
          Usa la cámara de tu dispositivo
        </div>
      </v-card>
      <v-card
        class="studio__option"
        variant="outlined"
        :disabled="loadingPhoto"
        @click="pickFile"
      >
        <v-progress-circular
          v-if="loadingPhoto"
          indeterminate
          color="accent"
          size="40"
        />
        <v-icon
          v-else
          icon="mdi-image-plus-outline"
          size="40"
          color="accent"
        />
        <div class="text-subtitle-1 font-weight-bold mt-3">
          Subir una foto
        </div>
        <div class="text-body-2 text-medium-emphasis">
          JPG, PNG o WEBP, hasta 10 MB
        </div>
      </v-card>
      <p class="studio__tips text-body-2 text-medium-emphasis">
        <v-icon
          icon="mdi-lightbulb-on-outline"
          size="18"
          class="mr-1"
        />
        Mira de frente, con buena luz y sin lentes oscuros ni gorra.
      </p>
    </div>

    <!-- 2. Cámara -->
    <CameraCapture
      v-else-if="step === 'camera'"
      facing="user"
      confirm-text="Usar esta foto"
      @capture="useBlob"
      @cancel="step = 'source'"
    />

    <!-- 3. Editar -->
    <div
      v-else
      class="studio__editor"
    >
      <div class="studio__preview">
        <canvas
          ref="canvas"
          :width="PORTRAIT_WIDTH"
          :height="PORTRAIT_HEIGHT"
          class="studio__canvas"
          :class="{ 'studio__canvas--compare': showOriginal }"
          role="img"
          aria-label="Vista previa de tu foto. Arrastra para mover la foto o un sticker."
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="onPointerUp"
          @wheel.prevent="onWheel"
        />
        <div class="text-caption text-medium-emphasis text-center mt-2">
          Arrastra para acomodar tu rostro dentro de la guía.
        </div>
        <v-btn
          class="mt-2"
          block
          variant="tonal"
          prepend-icon="mdi-compare"
          @pointerdown="showOriginal = true"
          @pointerup="showOriginal = false"
          @pointerleave="showOriginal = false"
          @keydown.space.prevent="showOriginal = true"
          @keyup.space="showOriginal = false"
        >
          Mantén presionado para ver la original
        </v-btn>
      </div>

      <div class="studio__panel">
        <!-- Recorte -->
        <section class="studio__section">
          <h3 class="studio__title">
            <v-icon
              icon="mdi-crop"
              size="18"
            /> Recorte del rostro
          </h3>
          <v-slider
            v-model="state.zoom"
            :min="MIN_ZOOM"
            :max="MAX_ZOOM"
            :step="0.01"
            color="accent"
            hide-details
            prepend-icon="mdi-magnify-minus-outline"
            append-icon="mdi-magnify-plus-outline"
            aria-label="Zoom"
          />
          <div class="d-flex flex-wrap ga-2 mt-2">
            <v-btn
              size="small"
              variant="tonal"
              prepend-icon="mdi-image-filter-center-focus"
              @click="resetCrop"
            >
              Centrar
            </v-btn>
            <v-btn
              size="small"
              :variant="state.oval ? 'flat' : 'tonal'"
              :color="state.oval ? 'accent' : undefined"
              prepend-icon="mdi-ellipse-outline"
              @click="state.oval = !state.oval"
            >
              Marco ovalado
            </v-btn>
            <v-btn
              v-if="canSegment"
              size="small"
              color="primary"
              prepend-icon="mdi-auto-fix"
              :loading="segmenting"
              @click="segmentFace"
            >
              Quitar fondo
            </v-btn>
            <v-btn
              v-if="segmented"
              size="small"
              variant="text"
              prepend-icon="mdi-undo"
              @click="undoSegment"
            >
              Restaurar fondo
            </v-btn>
          </div>
          <div
            v-if="segmented || state.oval"
            class="d-flex align-center ga-2 mt-3"
          >
            <span class="text-caption text-medium-emphasis">Fondo</span>
            <button
              v-for="color in PORTRAIT_BACKGROUNDS"
              :key="color"
              type="button"
              class="studio__swatch"
              :class="{ 'studio__swatch--active': state.background === color }"
              :style="{ background: color }"
              :aria-label="`Fondo ${color}`"
              @click="state.background = color"
            />
          </div>
        </section>

        <!-- Filtros -->
        <section class="studio__section">
          <h3 class="studio__title">
            <v-icon
              icon="mdi-palette-outline"
              size="18"
            /> Filtros
          </h3>
          <v-chip-group
            v-model="state.filter"
            mandatory
            selected-class="text-accent"
            column
          >
            <v-chip
              v-for="f in PORTRAIT_FILTERS"
              :key="f.name"
              :value="f.name"
              variant="outlined"
              size="small"
              filter
            >
              {{ f.label }}
            </v-chip>
          </v-chip-group>
        </section>

        <!-- Stickers -->
        <section class="studio__section">
          <h3 class="studio__title">
            <v-icon
              icon="mdi-sticker-emoji"
              size="18"
            /> Stickers
            <span class="text-caption text-medium-emphasis ml-auto">
              {{ state.stickers.length }}/{{ MAX_PORTRAIT_STICKERS }}
            </span>
          </h3>
          <div class="studio__stickers">
            <button
              v-for="emoji in PORTRAIT_STICKERS"
              :key="emoji"
              type="button"
              class="studio__sticker"
              :disabled="stickersLeft <= 0"
              :aria-label="`Agregar sticker ${emoji}`"
              @click="onAddSticker(emoji)"
            >
              {{ emoji }}
            </button>
          </div>
          <div
            v-if="selected"
            class="d-flex align-center ga-2 mt-3"
          >
            <span class="text-h6">{{ selected.emoji }}</span>
            <v-slider
              :model-value="selected.size"
              :min="0.08"
              :max="0.4"
              :step="0.01"
              color="accent"
              hide-details
              aria-label="Tamaño del sticker"
              @update:model-value="onResizeSelected"
            />
            <v-btn
              icon="mdi-delete-outline"
              size="small"
              variant="text"
              color="error"
              aria-label="Quitar sticker"
              @click="onRemoveSelected"
            />
          </div>
          <p
            v-else-if="state.stickers.length"
            class="text-caption text-medium-emphasis mt-2"
          >
            Toca un sticker en la foto para moverlo, cambiar su tamaño o quitarlo.
          </p>
        </section>

        <div class="d-flex flex-wrap ga-2 mt-auto">
          <v-btn
            variant="text"
            prepend-icon="mdi-camera-retake-outline"
            @click="step = 'source'"
          >
            Cambiar foto
          </v-btn>
          <v-spacer />
          <v-btn
            color="primary"
            size="large"
            prepend-icon="mdi-check"
            :loading="saving"
            @click="save"
          >
            Guardar foto
          </v-btn>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.studio__source {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.studio__option {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 32px 16px;
  min-height: 190px;
  border-color: var(--nt-border, rgba(148, 163, 184, 0.3));
  transition: border-color 0.15s ease, transform 0.15s ease;
}

.studio__option:hover {
  border-color: rgb(var(--v-theme-accent));
  transform: translateY(-2px);
}

.studio__tips {
  grid-column: 1 / -1;
  margin: 0;
}

.studio__editor {
  display: grid;
  grid-template-columns: minmax(0, 340px) minmax(0, 1fr);
  gap: 24px;
  align-items: start;
}

.studio__canvas {
  display: block;
  width: 100%;
  aspect-ratio: 3 / 4;
  border-radius: 12px;
  background: var(--nt-surface, #1e293b);
  touch-action: none;
  cursor: grab;
  box-shadow: 0 0 0 1px rgba(148, 163, 184, 0.25);
}

.studio__canvas:active {
  cursor: grabbing;
}

.studio__canvas--compare {
  cursor: default;
  box-shadow: 0 0 0 2px rgb(var(--v-theme-accent));
}

.studio__panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-height: 100%;
}

.studio__title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.95rem;
  font-weight: 700;
  margin-bottom: 8px;
}

.studio__swatch {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid rgba(148, 163, 184, 0.4);
  cursor: pointer;
}

.studio__swatch--active {
  border-color: rgb(var(--v-theme-accent));
  box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.35);
}

.studio__stickers {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(44px, 1fr));
  gap: 8px;
}

.studio__sticker {
  height: 44px;
  font-size: 1.5rem;
  border-radius: 10px;
  border: 1px solid rgba(148, 163, 184, 0.3);
  background: transparent;
  cursor: pointer;
  transition: transform 0.12s ease, border-color 0.12s ease;
}

.studio__sticker:hover:not(:disabled) {
  transform: scale(1.08);
  border-color: rgb(var(--v-theme-accent));
}

.studio__sticker:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

@media (max-width: 760px) {
  .studio__editor {
    grid-template-columns: minmax(0, 1fr);
  }

  .studio__preview {
    max-width: 340px;
    margin: 0 auto;
    width: 100%;
  }
}

@media (max-width: 520px) {
  .studio__source {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
