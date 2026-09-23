<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { DesignExport, ProductTemplate, SideKey } from '../types/editor'
import { MAX_STICKERS_PER_SIDE } from '../types/editor'
import { useProductEditor } from '../composables/useProductEditor'
import { EDITOR_COLORS, STICKERS } from '../config/products'
import EditorContextPanel from './EditorContextPanel.vue'
import { ImageValidationError } from '~/utils/image'

/**
 * Editor de personalización (client-only: usar dentro de <ClientOnly>).
 * Emite `complete` con el JSON (ConfiguracionJson) y los PNG finales por zona.
 */
const props = defineProps<{
  template: ProductTemplate
  /** El padre está guardando (deshabilita "Listo"). */
  saving?: boolean
  /** Texto del botón final. */
  finishText?: string
}>()
const emit = defineEmits<{ complete: [result: DesignExport] }>()

const editor = useProductEditor(props.template)
const snackbar = useSnackbar()
const { confirm } = useConfirm()

const stageWrap = ref<HTMLDivElement | null>(null)
const canvasA = ref<HTMLCanvasElement | null>(null)
const canvasB = ref<HTMLCanvasElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const displayWidth = ref(360)
const imageDialog = ref(false)
const imageTab = ref<'upload' | 'camera'>('upload')
const preview = ref<{ open: boolean, urls: Partial<Record<SideKey, string>> }>({ open: false, urls: {} })
const finishing = ref(false)

const isFlipped = computed(() => editor.activeSide.value === 'B')
const displayHeight = computed(() => Math.round(displayWidth.value * props.template.height / props.template.width))
const outlineRadius = computed(() => {
  if (props.template.shape === 'CIRCULAR') return '50%'
  return `${Math.round((props.template.cornerRadius ?? 0) * displayWidth.value / props.template.width)}px`
})
const savedLabel = computed(() => {
  const d = editor.lastSavedAt.value
  return d ? `Guardado ${d.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })}` : 'Sin cambios'
})

let resizeObserver: ResizeObserver | null = null

function measure(): number {
  const w = stageWrap.value?.clientWidth ?? 360
  const maxByHeight = (window.innerHeight * 0.62) * props.template.width / props.template.height
  return Math.max(240, Math.min(w - 16, 560, maxByHeight))
}

// ---------- imágenes ----------

async function handleImage(blob: Blob): Promise<void> {
  imageDialog.value = false
  try {
    await editor.addImage(blob)
  }
  catch (e) {
    snackbar.error(e instanceof ImageValidationError ? e.message : 'No se pudo agregar la imagen.')
  }
}

function onFileSelected(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) void handleImage(file)
}

function onDrop(event: DragEvent): void {
  const file = event.dataTransfer?.files?.[0]
  if (file) void handleImage(file)
}

// ---------- acciones ----------

function addSticker(emoji: string): void {
  if (!editor.addSticker(emoji)) snackbar.warning(`Máximo ${MAX_STICKERS_PER_SIDE} stickers por lado.`)
}

async function clearSide(): Promise<void> {
  const ok = await confirm({
    title: `¿Vaciar ${props.template.zones.find(z => z.key === editor.activeSide.value)?.name}?`,
    message: 'Se eliminarán todos los elementos de este lado. Puedes deshacerlo con Ctrl+Z.',
    confirmText: 'Vaciar',
    danger: true
  })
  if (ok) await editor.clearSide()
}

function revokePreview(): void {
  Object.values(preview.value.urls).forEach(url => url && URL.revokeObjectURL(url))
  preview.value = { open: false, urls: {} }
}

async function openPreview(): Promise<void> {
  revokePreview()
  const urls: Partial<Record<SideKey, string>> = {}
  for (const key of editor.sideKeys) {
    const blob = await editor.exportSide(key, 0.5)
    if (blob) urls[key] = URL.createObjectURL(blob)
  }
  preview.value = { open: true, urls }
}

async function finish(): Promise<void> {
  const missing = editor.missingRequiredSides()
  if (missing.length > 0) {
    const names = missing.map(k => props.template.zones.find(z => z.key === k)?.name).join(' y ')
    snackbar.warning(`Falta diseñar: ${names}.`)
    editor.setSide(missing[0]!)
    return
  }
  finishing.value = true
  try {
    const result = await editor.exportDesign()
    emit('complete', result)
  }
  catch {
    snackbar.error('No se pudo generar el diseño final.')
  }
  finally {
    finishing.value = false
  }
}

// ---------- atajos de teclado ----------

function isTyping(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
    // Fabric usa un textarea oculto mientras se edita un texto.
    return true
  }
  return false
}

function onKeydown(event: KeyboardEvent): void {
  if (isTyping(event)) return
  const mod = event.ctrlKey || event.metaKey
  const key = event.key.toLowerCase()
  if (mod && key === 'z' && !event.shiftKey) {
    event.preventDefault()
    void editor.undo()
  }
  else if (mod && (key === 'y' || (key === 'z' && event.shiftKey))) {
    event.preventDefault()
    void editor.redo()
  }
  else if (mod && key === 'd') {
    event.preventDefault()
    void editor.duplicateSelected()
  }
  else if ((key === 'delete' || key === 'backspace') && editor.selection.value.count > 0) {
    event.preventDefault()
    editor.removeSelected()
  }
}

// ---------- ciclo de vida ----------

onMounted(async () => {
  displayWidth.value = measure()
  await editor.mount({ A: canvasA.value ?? undefined, B: canvasB.value ?? undefined }, displayWidth.value)

  resizeObserver = new ResizeObserver(() => {
    const w = measure()
    if (Math.abs(w - displayWidth.value) > 2) {
      displayWidth.value = w
      editor.resize(w)
    }
  })
  if (stageWrap.value) resizeObserver.observe(stageWrap.value)
  window.addEventListener('keydown', onKeydown)

  const draft = editor.readDraft()
  const hasContent = draft && Object.values(draft.zones).some(z => ((z?.fabric.objects as unknown[] | undefined)?.length ?? 0) > 0)
  if (draft && hasContent) {
    const recover = await confirm({
      title: 'Tienes un diseño sin terminar',
      message: '¿Quieres recuperarlo y seguir donde lo dejaste?',
      confirmText: 'Recuperar',
      cancelText: 'Empezar de cero'
    })
    if (recover) {
      await editor.restore(draft)
      snackbar.success('Diseño recuperado')
    }
    else {
      editor.discardDraft()
    }
  }
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  window.removeEventListener('keydown', onKeydown)
  revokePreview()
})
</script>

<template>
  <div class="customizer">
    <!-- Encabezado -->
    <header class="customizer__header">
      <div>
        <h2 class="text-h6 font-weight-bold">
          {{ template.name }}
          <v-chip
            v-if="template.provisional"
            size="x-small"
            color="warning"
            variant="tonal"
            class="ml-2"
          >
            medidas provisionales
          </v-chip>
        </h2>
        <span class="text-caption text-medium-emphasis">
          <v-icon
            icon="mdi-cloud-check-outline"
            size="14"
          />
          {{ savedLabel }}
        </span>
      </div>
      <v-spacer />
      <div class="d-flex ga-1">
        <v-btn
          icon="mdi-undo"
          variant="text"
          :disabled="!editor.canUndo.value"
          aria-label="Deshacer (Ctrl+Z)"
          title="Deshacer (Ctrl+Z)"
          @click="editor.undo()"
        />
        <v-btn
          icon="mdi-redo"
          variant="text"
          :disabled="!editor.canRedo.value"
          aria-label="Rehacer (Ctrl+Y)"
          title="Rehacer (Ctrl+Y)"
          @click="editor.redo()"
        />
        <v-btn
          variant="tonal"
          prepend-icon="mdi-eye-outline"
          @click="openPreview"
        >
          Vista previa
        </v-btn>
        <v-btn
          color="primary"
          prepend-icon="mdi-check"
          :loading="finishing || saving"
          @click="finish"
        >
          {{ finishText ?? 'Listo' }}
        </v-btn>
      </div>
    </header>

    <div class="customizer__body">
      <!-- Herramientas -->
      <aside
        class="customizer__tools"
        aria-label="Herramientas"
      >
        <v-btn
          class="tool"
          variant="tonal"
          prepend-icon="mdi-format-text"
          @click="editor.addText()"
        >
          Texto
        </v-btn>
        <v-btn
          class="tool"
          variant="tonal"
          prepend-icon="mdi-image-plus-outline"
          :loading="editor.isBusy.value"
          @click="imageDialog = true"
        >
          Imagen
        </v-btn>
        <v-menu :close-on-content-click="true">
          <template #activator="{ props: menuProps }">
            <v-btn
              class="tool"
              variant="tonal"
              prepend-icon="mdi-sticker-emoji"
              v-bind="menuProps"
            >
              Sticker
            </v-btn>
          </template>
          <v-card class="pa-3">
            <div class="stickers">
              <button
                v-for="s in STICKERS"
                :key="s"
                type="button"
                class="sticker"
                :aria-label="`Sticker ${s}`"
                @click="addSticker(s)"
              >
                {{ s }}
              </button>
            </div>
          </v-card>
        </v-menu>
        <v-menu :close-on-content-click="false">
          <template #activator="{ props: menuProps }">
            <v-btn
              class="tool"
              variant="tonal"
              prepend-icon="mdi-format-color-fill"
              v-bind="menuProps"
            >
              Fondo
            </v-btn>
          </template>
          <v-card class="pa-3">
            <div class="bg-swatches">
              <button
                v-for="c in ['#FFFFFF', ...EDITOR_COLORS]"
                :key="c"
                type="button"
                class="bg-swatch"
                :style="{ background: c }"
                :aria-label="`Fondo ${c}`"
                @click="editor.setBackground(c)"
              />
            </div>
          </v-card>
        </v-menu>
        <v-btn
          class="tool"
          variant="text"
          color="error"
          prepend-icon="mdi-eraser"
          @click="clearSide"
        >
          Vaciar lado
        </v-btn>
      </aside>

      <!-- Escenario con flip A/B -->
      <section
        ref="stageWrap"
        class="customizer__stage"
        @dragover.prevent
        @drop.prevent="onDrop"
      >
        <div
          class="flipper"
          :class="{ 'flipper--flipped': isFlipped }"
          :style="{ width: `${displayWidth}px`, height: `${displayHeight}px` }"
        >
          <div
            class="face face--front"
            :style="{ '--outline-radius': outlineRadius }"
            :aria-hidden="isFlipped"
          >
            <canvas ref="canvasA" />
          </div>
          <div
            v-if="editor.sideKeys.includes('B')"
            class="face face--back"
            :style="{ '--outline-radius': outlineRadius }"
            :aria-hidden="!isFlipped"
          >
            <canvas ref="canvasB" />
          </div>
        </div>

        <v-btn-toggle
          v-if="editor.sideKeys.length > 1"
          :model-value="editor.activeSide.value"
          mandatory
          variant="outlined"
          color="primary"
          density="comfortable"
          class="mt-5"
          @update:model-value="(v: SideKey) => editor.setSide(v)"
        >
          <v-btn
            v-for="z in template.zones"
            :key="z.key"
            :value="z.key"
            prepend-icon="mdi-rotate-3d-variant"
          >
            {{ z.name }}
          </v-btn>
        </v-btn-toggle>
        <p class="text-caption text-medium-emphasis mt-2">
          Arrastra una imagen aquí · Supr para eliminar · Ctrl+D para duplicar
        </p>
      </section>

      <!-- Propiedades -->
      <aside
        class="customizer__panel"
        aria-label="Propiedades del elemento"
      >
        <EditorContextPanel :editor="editor" />
      </aside>
    </div>

    <!-- Diálogo: agregar imagen -->
    <v-dialog
      v-model="imageDialog"
      max-width="480"
    >
      <v-card rounded="lg">
        <v-tabs
          v-model="imageTab"
          grow
          color="primary"
        >
          <v-tab
            value="upload"
            prepend-icon="mdi-upload"
          >
            Subir
          </v-tab>
          <v-tab
            value="camera"
            prepend-icon="mdi-camera"
          >
            Cámara
          </v-tab>
        </v-tabs>
        <v-card-text>
          <div
            v-if="imageTab === 'upload'"
            class="upload"
          >
            <v-icon
              icon="mdi-image-outline"
              size="48"
              class="mb-2"
            />
            <p class="text-body-2 text-medium-emphasis mb-4">
              JPG, PNG o WEBP · máximo 10 MB
            </p>
            <v-btn
              color="primary"
              @click="fileInput?.click()"
            >
              Elegir imagen
            </v-btn>
            <input
              ref="fileInput"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              @change="onFileSelected"
            >
          </div>
          <CameraCapture
            v-else-if="imageDialog"
            @capture="handleImage"
            @cancel="imageDialog = false"
          />
        </v-card-text>
      </v-card>
    </v-dialog>

    <!-- Diálogo: vista previa A/B -->
    <v-dialog
      :model-value="preview.open"
      max-width="760"
      @update:model-value="(v: boolean) => { if (!v) revokePreview() }"
    >
      <v-card rounded="lg">
        <v-card-title class="pt-5 px-6">
          Vista previa
        </v-card-title>
        <v-card-text>
          <div class="previews">
            <figure
              v-for="z in template.zones"
              :key="z.key"
              class="preview"
            >
              <img
                v-if="preview.urls[z.key]"
                :src="preview.urls[z.key]"
                :alt="`Vista previa ${z.name}`"
                :style="{ borderRadius: template.shape === 'CIRCULAR' ? '50%' : '8px' }"
              >
              <figcaption class="text-caption text-medium-emphasis mt-2">
                {{ z.name }}
              </figcaption>
            </figure>
          </div>
        </v-card-text>
        <v-card-actions class="px-6 pb-5">
          <v-spacer />
          <v-btn @click="revokePreview">
            Cerrar
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
.customizer {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.customizer__header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.customizer__body {
  display: grid;
  grid-template-columns: 180px minmax(0, 1fr) 280px;
  gap: 20px;
  align-items: start;
}

.customizer__tools {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tool {
  justify-content: flex-start;
}

.customizer__stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 8px;
  background:
    radial-gradient(circle at 50% 40%, rgb(37 99 235 / 10%), transparent 60%),
    var(--nt-surface);
  border: 1px solid var(--nt-border);
  border-radius: var(--nt-radius-lg);
  perspective: 1400px;
  min-width: 0;
}

.customizer__panel {
  padding: 16px;
  background: var(--nt-surface);
  border: 1px solid var(--nt-border);
  border-radius: var(--nt-radius-lg);
}

/* ---------- Flip ---------- */
.flipper {
  position: relative;
  transform-style: preserve-3d;
  transition: transform 650ms cubic-bezier(0.4, 0.2, 0.2, 1);
}

.flipper--flipped {
  transform: rotateY(180deg);
}

.face {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  filter: drop-shadow(0 12px 28px rgb(0 0 0 / 45%));
}

.face--back {
  transform: rotateY(180deg);
}

/* Contorno del área imprimible */
.face::after {
  content: '';
  position: absolute;
  inset: 0;
  border: 2px dashed rgb(6 182 212 / 55%);
  border-radius: var(--outline-radius);
  pointer-events: none;
}

/* ---------- Menús ---------- */
.stickers {
  display: grid;
  grid-template-columns: repeat(4, 44px);
  gap: 6px;
}

.sticker {
  width: 44px;
  height: 44px;
  font-size: 26px;
  border-radius: var(--nt-radius-sm);
  transition: background var(--nt-transition-fast);
}

.sticker:hover,
.sticker:focus-visible {
  background: var(--nt-surface-elevated);
}

.bg-swatches {
  display: grid;
  grid-template-columns: repeat(5, 30px);
  gap: 8px;
}

.bg-swatch {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 2px solid var(--nt-border);
}

.upload {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 0;
  text-align: center;
}

.previews {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 24px;
}

.preview {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.preview img {
  max-width: 300px;
  max-height: 340px;
  background: repeating-conic-gradient(#334155 0% 25%, #1e293b 0% 50%) 50% / 20px 20px;
}

/* ---------- Responsive ---------- */
@media (max-width: 1100px) {
  .customizer__body {
    grid-template-columns: minmax(0, 1fr) 260px;
  }

  .customizer__tools {
    grid-column: 1 / -1;
    flex-direction: row;
    flex-wrap: wrap;
  }
}

@media (max-width: 760px) {
  .customizer__body {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
