<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { DesignExport, ProductTemplate, SideKey } from '../types/editor'
import { MAX_STICKERS_PER_SIDE } from '../types/editor'
import { useProductEditor } from '../composables/useProductEditor'
import { EDITOR_COLORS, STICKERS } from '../config/products'
import EditorContextPanel from './EditorContextPanel.vue'
import { ImageValidationError } from '~/utils/image'
import { formatQ } from '~/utils/format'
import { normalizeNfcCustomerUrl, validateNfcCustomerUrl } from '../services/nfcValidation'

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
  initialNfcUrl?: string
}>()
const emit = defineEmits<{ complete: [result: DesignExport, nfcUrl: string] }>()
const nfcUrl = ref(props.initialNfcUrl ?? '')
const nfcError = ref('')
/** Al salir del campo se completa el protocolo para que el comprador vea lo que se va a guardar. */
function completarEnlace(): void {
  const completo = normalizeNfcCustomerUrl(nfcUrl.value)
  if (completo !== nfcUrl.value) nfcUrl.value = completo
}

/** true cuando el enlace ya es valido: cambia el bloque de "Obligatorio" a "Listo". */
const nfcListo = computed(() => !nfcError.value && validateNfcCustomerUrl(nfcUrl.value) === null)
watch(() => props.initialNfcUrl, (value) => { if (value) nfcUrl.value = value })

const editor = useProductEditor(props.template)
const snackbar = useSnackbar()
const { confirm } = useConfirm()

const stageWrap = ref<HTMLDivElement | null>(null)
const canvasA = ref<HTMLCanvasElement | null>(null)
const canvasB = ref<HTMLCanvasElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const displayWidth = ref(360)
const imageDialog = ref(false)
const nfcDialog = ref(false)
const propertiesDialog = ref(false)
const mobileToolsDialog = ref(false)
const mobileStickerDialog = ref(false)
const uploadPreview = ref<string | null>(null)
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
  const isPhone = window.innerWidth <= 760
  // En móvil reservamos espacio para las herramientas rápidas y el botón inferior.
  // El lienzo sigue siendo interactivo: solo se reduce su tamaño visual, no la resolución exportada.
  const maxByHeight = (window.innerHeight * (isPhone ? 0.31 : 0.62)) * props.template.width / props.template.height
  return Math.max(isPhone ? 150 : 240, Math.min(w - 16, 560, maxByHeight))
}

// ---------- imágenes ----------

async function handleImage(blob: Blob): Promise<void> {
  if (editor.isBusy.value) return
  imageDialog.value = false
  const localUrl = URL.createObjectURL(blob)
  uploadPreview.value = localUrl
  try {
    await editor.addImage(blob)
  }
  catch (e) {
    snackbar.error(e instanceof ImageValidationError ? e.message : 'No se pudo agregar la imagen.')
  }
  finally {
    if (uploadPreview.value === localUrl) uploadPreview.value = null
    URL.revokeObjectURL(localUrl)
  }
}

function onFileSelected(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) void handleImage(file)
}

/* ----- Deslizar con el dedo para girar entre lados ----- */
const SWIPE_MIN_PX = 60
let touchStartX = 0
let touchStartY = 0

function onTouchStart(event: TouchEvent): void {
  const touch = event.changedTouches[0]
  if (!touch) return
  touchStartX = touch.clientX
  touchStartY = touch.clientY
}

function onTouchEnd(event: TouchEvent): void {
  if (editor.sideKeys.length < 2) return
  // Si hay algo seleccionado el usuario está moviendo un objeto, no girando el producto.
  if (editor.selection.value.kind !== null) return

  const touch = event.changedTouches[0]
  if (!touch) return
  const dx = touch.clientX - touchStartX
  const dy = touch.clientY - touchStartY

  // Solo cuenta si el gesto fue claramente horizontal, para no pelear con el scroll.
  if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return

  const actual = editor.sideKeys.indexOf(editor.activeSide.value)
  const siguiente = (actual + (dx < 0 ? 1 : -1) + editor.sideKeys.length) % editor.sideKeys.length
  const destino = editor.sideKeys[siguiente]
  if (destino) editor.setSide(destino)
}

function onDrop(event: DragEvent): void {
  const file = event.dataTransfer?.files?.[0]
  if (file) void handleImage(file)
}

// ---------- acciones ----------

function addSticker(emoji: string): void {
  if (!editor.addSticker(emoji)) snackbar.warning(`Máximo ${MAX_STICKERS_PER_SIDE} stickers por lado.`)
}

function addMobileSticker(emoji: string): void {
  addSticker(emoji)
  mobileStickerDialog.value = false
}

async function removePhoto(): Promise<void> {
  if (!editor.activeSideHasPhoto.value || editor.isBusy.value) return
  const ok = await confirm({
    title: '¿Eliminar solo esta foto?',
    message: 'Se quitará la foto seleccionada o la última que agregaste en este lado. Se conservarán los textos, stickers y el fondo. Puedes deshacer el cambio.',
    confirmText: 'Eliminar foto',
    danger: true
  })
  if (ok && editor.removePhoto()) snackbar.success('Foto eliminada. Toca el círculo o Foto para agregar otra.')
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
  // Se envia la URL con el protocolo completo, no lo que el comprador tecleo.
  const url = normalizeNfcCustomerUrl(nfcUrl.value)
  const urlError = validateNfcCustomerUrl(url)
  if (urlError) {
    nfcError.value = urlError
    snackbar.warning(urlError)
    // En móvil el NFC está en un diálogo para no ocupar toda la pantalla.
    if (window.innerWidth <= 760) nfcDialog.value = true
    return
  }
  nfcError.value = ''
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
    emit('complete', result, url)
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
        <!-- El nombre del producto ya aparece en el selector de arriba: no se repite. -->
        <v-chip
          v-if="template.provisional"
          size="x-small"
          color="warning"
          variant="tonal"
          class="mr-2"
        >
          medidas provisionales
        </v-chip>
        <span class="text-caption text-medium-emphasis">
          <v-icon
            icon="mdi-cloud-check-outline"
            size="14"
          />
          {{ savedLabel }}
        </span>
      </div>
      <v-spacer />
      <div class="customizer__actions">
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
        <v-btn class="customizer__desktop-finish" color="primary" prepend-icon="mdi-check" :loading="finishing || saving || editor.isBusy.value" :disabled="editor.isBusy.value" @click="finish">
          {{ finishText ?? 'Listo' }}
        </v-btn>
      </div>
    </header>

    <!-- Acciones siempre visibles en teléfono. El círculo original sigue abriendo la foto. -->
    <nav class="customizer__mobile-toolbar" aria-label="Herramientas rápidas de personalización">
      <button type="button" class="customizer__quick-tool" :disabled="editor.isBusy.value" @click="imageDialog = true">
        <v-icon icon="mdi-image-plus-outline" size="21" />
        <span>Foto</span>
      </button>
      <button type="button" class="customizer__quick-tool" :disabled="editor.isBusy.value" @click="editor.addText()">
        <v-icon icon="mdi-format-text" size="21" />
        <span>Texto</span>
      </button>
      <button type="button" class="customizer__quick-tool" :disabled="editor.isBusy.value" @click="mobileStickerDialog = true">
        <v-icon icon="mdi-sticker-emoji-outline" size="21" />
        <span>Sticker</span>
      </button>
      <button type="button" class="customizer__quick-tool customizer__quick-tool--remove" :disabled="!editor.activeSideHasPhoto.value || editor.isBusy.value" @click="removePhoto">
        <v-icon icon="mdi-image-remove-outline" size="21" />
        <span>Quitar foto</span>
      </button>
      <button type="button" class="customizer__quick-tool" :class="{ 'customizer__quick-tool--pending': !nfcListo }" :aria-label="nfcListo ? 'Más herramientas' : 'Más herramientas, NFC pendiente'" @click="mobileToolsDialog = true">
        <v-icon icon="mdi-dots-horizontal-circle-outline" size="21" />
        <span>Más</span>
      </button>
    </nav>

    <div class="customizer__body">
      <!-- Herramientas -->
      <aside
        class="customizer__tools"
        aria-label="Herramientas"
      >
        <v-btn class="tool customizer__mobile-nfc text-none" variant="tonal" prepend-icon="mdi-nfc" :color="nfcListo ? 'success' : 'accent'" @click="nfcDialog = true">
          {{ nfcListo ? 'NFC configurado' : 'Completar NFC' }}
        </v-btn>
        <span class="tools__label">Agregar:</span>
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
          v-if="editor.activeSideHasPhoto.value"
          class="tool"
          variant="tonal"
          color="error"
          prepend-icon="mdi-image-remove-outline"
          :disabled="editor.isBusy.value"
          @click="removePhoto"
        >
          Quitar foto
        </v-btn>
        <v-btn
          class="tool"
          variant="text"
          color="error"
          prepend-icon="mdi-eraser"
          @click="clearSide"
        >
          Vaciar lado
        </v-btn>
        <v-btn class="tool customizer__mobile-properties text-none" variant="tonal" prepend-icon="mdi-tune-variant" @click="propertiesDialog = true">
          Ajustar elemento
        </v-btn>
      </aside>

      <!-- Escenario con flip A/B -->
      <section
        ref="stageWrap"
        class="customizer__stage"
        :class="{ 'customizer__stage--manual': editor.manualAdjust.value }"
        @dragover.prevent
        @drop.prevent="onDrop"
        @touchstart.passive="onTouchStart"
        @touchend.passive="onTouchEnd"
      >
        <div v-if="uploadPreview" class="customizer__upload-preview" :style="{ width: `${displayWidth}px`, height: `${displayHeight}px`, borderRadius: outlineRadius }" role="status" aria-label="Preparando tu foto">
          <img :src="uploadPreview" alt="Foto seleccionada, preparando diseño" :style="{ objectFit: template.shape === 'CIRCULAR' ? 'cover' : 'contain' }">
          <span>Preparando tu foto…</span>
        </div>
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
            <button
              v-if="editor.activeSideIsEmpty.value && !isFlipped"
              type="button"
              class="face__hint"
              @click="imageDialog = true"
            >
              <v-icon
                icon="mdi-image-plus"
                size="34"
              />
              <span>Toca para agregar tu imagen</span>
            </button>
          </div>
          <div
            v-if="editor.sideKeys.includes('B')"
            class="face face--back"
            :style="{ '--outline-radius': outlineRadius }"
            :aria-hidden="!isFlipped"
          >
            <canvas ref="canvasB" />
            <button
              v-if="editor.activeSideIsEmpty.value && isFlipped"
              type="button"
              class="face__hint"
              @click="imageDialog = true"
            >
              <v-icon
                icon="mdi-image-plus"
                size="34"
              />
              <span>Toca para agregar tu imagen</span>
            </button>
          </div>
        </div>

        <v-btn class="customizer__quick-photo text-none" color="primary" variant="tonal" prepend-icon="mdi-image-plus-outline" :loading="editor.isBusy.value" @click="imageDialog = true">
          Subir foto
        </v-btn>
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
        <v-btn
          v-if="!editor.activeSideIsEmpty.value"
          :color="editor.manualAdjust.value ? 'accent' : undefined"
          :variant="editor.manualAdjust.value ? 'flat' : 'outlined'"
          size="small"
          class="text-none mt-3"
          :prepend-icon="editor.manualAdjust.value ? 'mdi-lock-open-variant-outline' : 'mdi-cursor-move'"
          @click="editor.setManualAdjust(!editor.manualAdjust.value)"
        >
          {{ editor.manualAdjust.value ? 'Terminar ajuste manual' : 'Ajuste manual' }}
        </v-btn>

        <p class="text-caption text-medium-emphasis mt-2">
          <template v-if="editor.manualAdjust.value">
            Arrastra la imagen para acomodarla · Supr para eliminar · Ctrl+D para duplicar
          </template>
          <template v-else>
            Tu imagen ya quedó encuadrada · Desliza para girar al otro lado
          </template>
        </p>
      </section>

      <!-- Propiedades -->
      <!-- Solo aparece cuando hay algo seleccionado: si no, es un recuadro vacio que estorba. -->
      <aside
        v-if="editor.selection.value.count > 0"
        class="customizer__panel"
        aria-label="Propiedades del elemento"
      >
        <EditorContextPanel :editor="editor" />
      </aside>
    </div>
    <!-- NFC permanece obligatorio mientras el backend desplegado no admita nfcUrl=null. -->
    <section
      class="nfc customizer__desktop-nfc"
      :class="{ 'nfc--listo': nfcListo }"
    >
      <div class="nfc__head">
        <span class="nfc__icon">
          <v-icon
            :icon="nfcListo ? 'mdi-check-bold' : 'mdi-nfc-tap'"
            size="26"
          />
        </span>
        <div class="nfc__titles">
          <div class="nfc__title">
            ¿Qué se abre al tocar tu llavero?
            <v-chip
              size="x-small"
              :color="nfcListo ? 'success' : 'accent'"
              variant="flat"
              class="ml-2"
            >
              {{ nfcListo ? 'Listo' : 'Obligatorio' }}
            </v-chip>
          </div>
          <p class="nfc__sub">
            Tu llavero lleva un chip NFC. Pega aquí el enlace que quieras que se abra
            cuando alguien lo acerque al teléfono: tu playlist, un video o tu perfil.
          </p>
        </div>
      </div>

      <v-text-field
        v-model="nfcUrl"
        label="Pega tu enlace aquí"
        placeholder="https://open.spotify.com/..."
        prepend-inner-icon="mdi-link-variant"
        :counter="2048"
        :error-messages="nfcError ? [nfcError] : []"
        variant="solo-filled"
        flat
        bg-color="surface"
        class="mt-4"
        @update:model-value="nfcError = ''"
        @blur="completarEnlace"
      />
    </section>

    <!-- Ultimo paso: queda al final para no obligar a subir de nuevo. -->
    <v-btn
      color="primary"
      variant="flat"
      size="x-large"
      block
      class="text-none mt-5 customizer__desktop-bottom-finish"
      prepend-icon="mdi-cart-plus"
      :loading="finishing || saving"
      @click="finish"
    >
      {{ finishText ?? 'Listo' }}
    </v-btn>
    <p class="text-caption text-medium-emphasis text-center mt-2">
      Revisa tu diseño y tu enlace antes de continuar.
    </p>

    <div class="customizer__mobile-finish" aria-label="Finalizar personalización">
      <div class="customizer__mobile-total"><span>Tu diseño</span><strong>{{ template.price === undefined ? 'Personalizado' : formatQ(template.price) }}</strong></div>
      <v-btn color="primary" class="text-none" prepend-icon="mdi-cart-plus" :loading="finishing || saving || editor.isBusy.value" :disabled="editor.isBusy.value" @click="finish">{{ finishText ?? 'Listo' }}</v-btn>
    </div>

    <!-- Herramientas secundarias en un panel corto, sin desplazar el editor. -->
    <v-bottom-sheet v-model="mobileToolsDialog" inset>
      <v-card rounded="lg" class="customizer__mobile-sheet">
        <v-card-title class="d-flex align-center ga-2">
          Herramientas
          <v-spacer />
          <v-btn icon="mdi-close" variant="text" aria-label="Cerrar herramientas" @click="mobileToolsDialog = false" />
        </v-card-title>
        <v-card-text class="pt-0">
          <div class="customizer__more-grid">
            <v-btn class="text-none" variant="tonal" prepend-icon="mdi-nfc" :color="nfcListo ? 'success' : 'accent'" @click="mobileToolsDialog = false; nfcDialog = true">
              {{ nfcListo ? 'NFC listo' : 'Configurar NFC' }}
            </v-btn>
            <v-btn class="text-none" variant="tonal" prepend-icon="mdi-tune-variant" :disabled="editor.selection.value.count === 0" @click="mobileToolsDialog = false; propertiesDialog = true">
              Ajustar elemento
            </v-btn>
            <v-btn class="text-none" variant="tonal" :prepend-icon="editor.manualAdjust.value ? 'mdi-lock-open-variant-outline' : 'mdi-cursor-move'" :disabled="!editor.activeSideHasPhoto.value" @click="editor.setManualAdjust(!editor.manualAdjust.value); mobileToolsDialog = false">
              {{ editor.manualAdjust.value ? 'Terminar ajuste' : 'Mover foto' }}
            </v-btn>
            <v-btn class="text-none" variant="text" color="error" prepend-icon="mdi-eraser" @click="mobileToolsDialog = false; clearSide()">
              Vaciar lado
            </v-btn>
          </div>
          <div class="text-caption font-weight-bold mt-4 mb-2">Color del fondo</div>
          <div class="bg-swatches customizer__mobile-colors">
            <button v-for="c in ['#FFFFFF', ...EDITOR_COLORS]" :key="c" type="button" class="bg-swatch" :style="{ background: c }" :aria-label="`Fondo ${c}`" @click="editor.setBackground(c); mobileToolsDialog = false" />
          </div>
        </v-card-text>
      </v-card>
    </v-bottom-sheet>

    <v-bottom-sheet v-model="mobileStickerDialog" inset>
      <v-card rounded="lg" class="customizer__mobile-sheet">
        <v-card-title class="d-flex align-center ga-2">Agregar sticker <v-spacer /><v-btn icon="mdi-close" variant="text" aria-label="Cerrar stickers" @click="mobileStickerDialog = false" /></v-card-title>
        <v-card-text class="pt-0">
          <div class="stickers customizer__mobile-stickers">
            <button v-for="s in STICKERS" :key="s" type="button" class="sticker" :aria-label="`Sticker ${s}`" @click="addMobileSticker(s)">{{ s }}</button>
          </div>
        </v-card-text>
      </v-card>
    </v-bottom-sheet>

    <v-dialog v-model="nfcDialog" max-width="500" scrollable>
      <v-card rounded="lg">
        <v-card-title class="d-flex align-center ga-2"><v-icon icon="mdi-nfc" color="accent" /> Enlace NFC <v-spacer /><v-btn icon="mdi-close" variant="text" aria-label="Cerrar NFC" @click="nfcDialog = false" /></v-card-title>
        <v-card-text>
          <p class="text-body-2 mb-3">Para guardar tu personalización, ingresa el enlace HTTPS que abrirá el llavero.</p>
          <v-text-field v-model="nfcUrl" label="Enlace NFC (obligatorio)" placeholder="www.google.com o https://youtube.com/..." :counter="2048" :error-messages="nfcError ? [nfcError] : []" variant="outlined" density="comfortable" @update:model-value="nfcError = ''" @blur="completarEnlace" />
        </v-card-text>
        <v-card-actions class="px-4 pb-4"><v-spacer /><v-btn color="primary" variant="flat" @click="nfcDialog = false">Volver al diseño</v-btn></v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="propertiesDialog" max-width="520" scrollable>
      <v-card rounded="lg">
        <v-card-title class="d-flex align-center ga-2">Ajustes del elemento <v-spacer /><v-btn icon="mdi-close" variant="text" aria-label="Cerrar ajustes" @click="propertiesDialog = false" /></v-card-title>
        <v-card-text><EditorContextPanel :editor="editor" /></v-card-text>
        <v-card-actions><v-spacer /><v-btn variant="tonal" @click="propertiesDialog = false">Cerrar</v-btn></v-card-actions>
      </v-card>
    </v-dialog>

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

.customizer__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}

/* El nombre del producto puede ser largo: que corte y no empuje la fila. */
.customizer__header > div:first-child {
  min-width: 0;
  overflow-wrap: anywhere;
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

.tools__label {
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--nt-text-secondary);
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

/* En ajuste manual el lienzo necesita el gesto completo para arrastrar la imagen. */
.customizer__stage--manual .face,
.customizer__stage--manual .flipper {
  touch-action: none;
}

/* ---------- Enlace NFC ---------- */
.nfc {
  margin-top: 20px;
  padding: 18px;
  border: 1px solid rgb(6 182 212 / 55%);
  border-radius: var(--nt-radius-lg);
  background:
    linear-gradient(160deg, rgb(6 182 212 / 14%), rgb(15 23 42 / 92%));
  box-shadow: 0 0 34px -14px rgb(6 182 212 / 75%);
}

.nfc--listo {
  border-color: rgb(34 197 94 / 60%);
  background: linear-gradient(160deg, rgb(34 197 94 / 12%), rgb(15 23 42 / 92%));
  box-shadow: 0 0 30px -16px rgb(34 197 94 / 70%);
}

.nfc__head {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}

.nfc__icon {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 46px;
  height: 46px;
  border-radius: 14px;
  color: #06240f;
  background: var(--nt-accent);
}

.nfc--listo .nfc__icon {
  background: #22c55e;
}

.nfc__titles {
  min-width: 0;
}

.nfc__title {
  font-size: 1.05rem;
  font-weight: 800;
  line-height: 1.3;
  color: var(--nt-text);
}

.nfc__sub {
  margin: 6px 0 0;
  font-size: 0.82rem;
  line-height: 1.5;
  color: var(--nt-text-secondary);
}

/* Capa que invita a tocar el lienzo cuando el lado está vacío. */
.face__hint {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px;
  text-align: center;
  font: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  color: #334155;
  background: transparent;
  border: 0;
  border-radius: inherit;
  cursor: pointer;
}

.face__hint:hover,
.face__hint:focus-visible {
  color: #0f172a;
  background: rgb(37 99 235 / 8%);
}

/* ---------- Flip ---------- */
.flipper {
  position: relative;
  touch-action: pan-y;
  transform-style: preserve-3d;
  transition: transform 650ms cubic-bezier(0.4, 0.2, 0.2, 1);
}

.flipper--flipped {
  transform: rotateY(180deg);
}

.face {
  position: absolute;
  inset: 0;
  /* El dedo hacia abajo scrollea la pagina; el horizontal queda para girar el producto. */
  touch-action: pan-y;
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

/* Herramientas rápidas: solo teléfono, nunca sustituyen las herramientas de escritorio. */
.customizer__mobile-toolbar { display: none; }
.customizer__mobile-sheet { max-height: min(78dvh, 540px); overflow-y: auto; }
.customizer__more-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.customizer__more-grid :deep(.v-btn) { min-width: 0; justify-content: start; font-size: .78rem; }
.customizer__mobile-colors { display: flex; flex-wrap: wrap; gap: 8px; }
.customizer__mobile-stickers { grid-template-columns: repeat(4, 44px); justify-content: center; }

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

  /* En telefono lo primero que debe ver el comprador es la pieza, no las herramientas. */
  .customizer__stage {
    order: -1;
  }
}

/* En teléfono los botones de acción ocupan su propia fila completa. */
@media (max-width: 560px) {
  .customizer__actions {
    width: 100%;
    justify-content: flex-start;
  }

  .customizer__actions .v-btn:not(.v-btn--icon) {
    flex: 1 1 auto;
  }
}
/* UX móvil integrada con Fabric oficial: no interfiere con los gestos ni el ajuste manual. */
.customizer__mobile-nfc, .customizer__mobile-properties, .customizer__mobile-finish, .customizer__quick-photo { display: none; }
.customizer__stage { position: relative; }
.customizer__upload-preview { position: absolute; z-index: 5; top: 22px; left: 50%; transform: translateX(-50%); display: grid; place-items: center; overflow: hidden; border: 1px solid var(--nt-border); background: var(--nt-surface); pointer-events: none; }
.customizer__upload-preview img { max-width: 100%; max-height: 100%; width: 100%; height: 100%; }
.customizer__upload-preview span { position: absolute; bottom: 6px; background: rgb(0 0 0 / 70%); color: white; font-size: .75rem; padding: 4px 8px; border-radius: 8px; }
@media (max-width: 760px) {
  .customizer { padding-bottom: calc(92px + env(safe-area-inset-bottom, 0px)); }
  .customizer__header { gap: 5px; flex-wrap: nowrap; }
  .customizer__header > div:first-child { flex: 0 1 auto; }
  .customizer__header .text-caption { font-size: .68rem !important; }
  .customizer__header .customizer__actions { gap: 2px; width: auto; flex: 1; justify-content: flex-end; flex-wrap: nowrap; }
  .customizer__header .customizer__actions .v-btn--icon { width: 34px; height: 34px; }
  .customizer__header .customizer__actions .v-btn:not(.v-btn--icon) { flex: 0 1 auto; min-width: 0; padding-inline: 8px; font-size: .72rem; }
  .customizer__desktop-finish, .customizer__desktop-bottom-finish, .customizer__desktop-nfc { display: none !important; }
  .customizer__body { gap: 10px; }
  .customizer__stage { padding: 12px 8px; }
  /* Cinco accesos a la vista; el resto queda en Más, sin scroll horizontal ni vertical. */
  .customizer__mobile-toolbar { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 5px; }
  .customizer__quick-tool { position: relative; min-width: 0; min-height: 54px; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 3px; border-radius: 10px; border: 1px solid var(--nt-border); background: var(--nt-surface-elevated); color: var(--nt-text); cursor: pointer; }
  .customizer__quick-tool span { font-size: .68rem; font-weight: 700; line-height: 1.15; text-align: center; white-space: nowrap; }
  .customizer__quick-tool:focus-visible { outline: 2px solid var(--nt-accent); outline-offset: 2px; }
  .customizer__quick-tool:disabled { opacity: .38; cursor: not-allowed; }
  .customizer__quick-tool--remove:not(:disabled) { color: #fca5a5; }
  .customizer__quick-tool--pending::after { content: ''; position: absolute; top: 5px; right: 7px; width: 6px; height: 6px; border-radius: 50%; background: var(--nt-accent); }
  .customizer__tools { display: none; }
  .customizer__mobile-nfc, .customizer__mobile-properties, .customizer__quick-photo { display: none; }
  .customizer__stage { padding: 8px 6px; }
  .customizer__stage > .v-btn.mt-3 { display: none; }
  .customizer__stage > .v-btn-toggle.mt-5 { margin-top: 8px !important; }
  .customizer__stage > p.text-caption { display: none; }
  .customizer__stage--manual > p.text-caption { display: block; margin: 6px 0 0 !important; }
  .customizer__upload-preview { top: 8px; }
  .customizer__panel { display: none; }
  .customizer > p.text-caption { display: none; }
  .customizer__mobile-finish { position: fixed; z-index: 15; left: 0; right: 0; bottom: 0; display: flex; align-items: center; gap: 12px; padding: 10px 16px calc(10px + env(safe-area-inset-bottom, 0px)); border-top: 1px solid var(--nt-border); background: var(--nt-surface); box-shadow: 0 -12px 30px rgb(0 0 0 / 16%); }
  .customizer__mobile-total { min-width: 0; flex: 1; display: flex; flex-direction: column; font-size: .75rem; color: var(--nt-text-secondary); }
  .customizer__mobile-total strong { color: var(--nt-text); font-size: 1.08rem; }
  .customizer__mobile-finish :deep(.v-btn) { min-height: 48px; }
}
</style>
