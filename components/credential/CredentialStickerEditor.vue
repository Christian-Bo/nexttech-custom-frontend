<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { allowedCredentialSlots, moveCredentialSticker, placeCredentialSticker } from '~/utils/credentialStickerSlots'

type StickerOption = { id: string, name: string }
const props = defineProps<{
  modelValue: Record<string, string>
  stickers: StickerOption[]
  stickerSlots: string[]
  portraitUrl: string
}>()
const emit = defineEmits<{ (e: 'update:modelValue', value: Record<string, string>): void }>()

const availableSlots = computed(() => allowedCredentialSlots(props.stickerSlots))
const selectedSticker = ref('')
const activeSlot = ref('')
const dragging = ref(false)
const draggedSticker = ref('')
const dragXY = ref({ x: 0, y: 0 })
let press: { x: number, y: number, id: string, source?: string } | null = null
let ignoreClicksBefore = 0

watch(() => props.stickers, (items) => {
  if (!items.some(s => s.id === selectedSticker.value)) selectedSticker.value = items[0]?.id || ''
}, { immediate: true })

function iconFor(id: string): string {
  return ({ STAR: 'mdi-star-four-points', GAMER: 'mdi-gamepad-variant', CODE: 'mdi-code-tags', TECH: 'mdi-laptop' } as Record<string, string>)[id] || 'mdi-sticker-emoji'
}
function nameFor(id: string): string { return props.stickers.find(s => s.id === id)?.name || id }
function labelFor(slot: string): string {
  return ({ TOP_LEFT: 'Arriba a la izquierda', TOP_RIGHT: 'Arriba a la derecha', BOTTOM_LEFT: 'Abajo a la izquierda', BOTTOM_RIGHT: 'Abajo a la derecha' } as Record<string, string>)[slot] || slot
}
function apply(target: string): void {
  if (!selectedSticker.value) return
  emit('update:modelValue', placeCredentialSticker(props.modelValue, selectedSticker.value, target, props.stickerSlots, props.stickers.map(s => s.id)))
  activeSlot.value = target
}
function remove(target: string): void {
  emit('update:modelValue', { ...props.modelValue, [target]: '' })
  activeSlot.value = target
}
function chooseSlot(target: string): void {
  if (Date.now() < ignoreClicksBefore) return
  apply(target)
}
function cancelDragging(): void {
  window.removeEventListener('pointermove', onDragMove)
  window.removeEventListener('pointerup', onDragEnd)
  window.removeEventListener('pointercancel', cancelDragging)
  dragging.value = false
  press = null
}
function onDragMove(e: PointerEvent): void {
  if (!press) return
  if (Math.hypot(e.clientX - press.x, e.clientY - press.y) < 8 && !dragging.value) return
  dragging.value = true
  dragXY.value = { x: e.clientX, y: e.clientY }
}
function onDragEnd(e: PointerEvent): void {
  const origin = press
  const didDrag = dragging.value
  // El elemento visual de arrastre no intercepta el punto de destino.
  const closest = (document.elementFromPoint(e.clientX, e.clientY) as Element | null)?.closest('[data-credential-slot]')
  const target = closest?.getAttribute('data-credential-slot') || ''
  cancelDragging()
  if (!origin || !didDrag) return
  ignoreClicksBefore = Date.now() + 350
  if (!availableSlots.value.some(s => s === target)) return
  if (origin.source) {
    emit('update:modelValue', moveCredentialSticker(props.modelValue, origin.source, target, props.stickerSlots))
  } else {
    emit('update:modelValue', placeCredentialSticker(props.modelValue, origin.id, target, props.stickerSlots, props.stickers.map(s => s.id)))
  }
  activeSlot.value = target
}
function beginDrag(e: PointerEvent, id: string, source?: string): void {
  if ((e.pointerType === 'mouse' && e.button !== 0) || !id) return
  if (!source) selectedSticker.value = id
  draggedSticker.value = id
  press = { x: e.clientX, y: e.clientY, id, source }
  dragXY.value = { x: e.clientX, y: e.clientY }
  window.addEventListener('pointermove', onDragMove, { passive: true })
  window.addEventListener('pointerup', onDragEnd)
  window.addEventListener('pointercancel', cancelDragging)
}
onBeforeUnmount(() => cancelDragging())
</script>

<template>
  <section class="sticker-editor" aria-label="Editor visual de stickers para credencial">
    <div class="text-subtitle-2 font-weight-bold mb-2">Selecciona tu sticker</div>
    <p class="text-caption text-medium-emphasis mb-3">
      Presiona un ícono y toca una posición de tu fotografía. También puedes arrastrarlo desde aquí o mover uno ya colocado.
    </p>
    <div class="sticker-palette" role="group" aria-label="Catálogo de stickers del backend">
      <button
        v-for="sticker in stickers" :key="sticker.id" type="button"
        class="sticker-palette__item" :class="{ 'sticker-palette__item--selected': selectedSticker === sticker.id }"
        :aria-pressed="selectedSticker === sticker.id" :aria-label="`Seleccionar sticker ${sticker.name}`"
        @click="selectedSticker = sticker.id"
        @pointerdown="beginDrag($event, sticker.id)"
      >
        <v-icon :icon="iconFor(sticker.id)" size="29" />
        <span>{{ sticker.name }}</span>
      </button>
    </div>

    <p class="text-subtitle-2 font-weight-bold mt-5 mb-2">Colócalo sobre tu fotografía</p>
    <div class="sticker-photo" aria-label="Fotografía con cuatro zonas de stickers">
      <img v-if="portraitUrl" :src="portraitUrl" alt="Fotografía oficial del comprador" class="sticker-photo__portrait" draggable="false">
      <div v-else class="sticker-photo__placeholder"><v-icon icon="mdi-account-circle" size="72" /><span>Retrato no disponible</span></div>
      <div v-for="slot in availableSlots" :key="slot" :data-credential-slot="slot" class="sticker-zone" :class="`sticker-zone--${slot.toLowerCase().replace('_', '-')}`">
        <button
          type="button" class="sticker-zone__button"
          :class="{ 'sticker-zone__button--filled': !!modelValue[slot], 'sticker-zone__button--active': activeSlot === slot }"
          :aria-label="`${labelFor(slot)}: ${modelValue[slot] ? nameFor(modelValue[slot]) : 'vacío'}. Tocar para colocar el sticker seleccionado`"
          @click="chooseSlot(slot)" @pointerdown="beginDrag($event, modelValue[slot], slot)"
        >
          <template v-if="modelValue[slot]">
            <v-icon :icon="iconFor(modelValue[slot])" size="31" />
            <span>{{ nameFor(modelValue[slot]) }}</span>
          </template>
          <template v-else>
            <v-icon icon="mdi-plus-circle-outline" size="24" />
            <span>{{ labelFor(slot) }}</span>
          </template>
        </button>
        <button v-if="modelValue[slot]" type="button" class="sticker-zone__remove" :aria-label="`Quitar sticker ${nameFor(modelValue[slot])} de ${labelFor(slot)}`" @click.stop="remove(slot)" @pointerdown.stop>
          <v-icon icon="mdi-close" size="16" />
        </button>
      </div>
    </div>
    <p class="text-caption text-medium-emphasis mt-3">
      El servidor admite hasta 4 stickers, uno por zona. Al arrastrar, el sticker se ajusta a una de las cuatro posiciones autorizadas.
    </p>
    <div v-if="dragging" class="sticker-drag-ghost" :style="{ left: `${dragXY.x}px`, top: `${dragXY.y}px` }" aria-hidden="true">
      <v-icon :icon="iconFor(draggedSticker)" size="32" />
    </div>
  </section>
</template>

<style scoped>
.sticker-palette { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 9px; }
.sticker-palette__item { border: 1px solid rgba(var(--v-border-color),.35); border-radius: 12px; background: rgba(var(--v-theme-surface-variant),.15); color: inherit; padding: 12px 3px; display: flex; flex-direction: column; align-items: center; gap: 6px; font-weight: 600; font-size: 11px; cursor: grab; touch-action: none; }
.sticker-palette__item--selected { border: 2px solid rgb(var(--v-theme-primary)); background: rgba(var(--v-theme-primary),.15); }
.sticker-palette__item:focus-visible, .sticker-zone button:focus-visible { outline: 3px solid rgb(var(--v-theme-primary)); outline-offset: 2px; }
.sticker-photo { width: min(100%, 340px); aspect-ratio: 1 / 1; border-radius: 16px; overflow: hidden; position: relative; background: #253858; margin: auto; border: 1px solid rgba(var(--v-border-color), .35); }
.sticker-photo__portrait { display: block; width: 100%; height: 100%; object-fit: cover; }
.sticker-photo__placeholder { position: absolute; inset: 0; display: flex; flex-direction: column; gap: 5px; align-items: center; justify-content: center; color: #dce6f7; }
.sticker-zone { position: absolute; width: 50%; height: 50%; display: flex; justify-content: center; align-items: center; padding: 7px; }
.sticker-zone--top-left { top: 0; left: 0; }
.sticker-zone--top-right { top: 0; right: 0; }
.sticker-zone--bottom-left { bottom: 0; left: 0; }
.sticker-zone--bottom-right { bottom: 0; right: 0; }
.sticker-zone__button { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; width: 100%; min-height: 72px; max-width: 120px; padding: 9px 2px; border: 1px dashed rgba(255,255,255,.85); border-radius: 12px; background: rgba(4,17,38,.45); color: white; font-size: 10px; cursor: pointer; touch-action: none; text-align: center; text-shadow: 0 1px 3px #000; }
.sticker-zone__button--filled { border: 1px solid #fff; background: rgba(6,28,65,.68); cursor: grab; }
.sticker-zone__button--active { box-shadow: 0 0 0 2px rgb(var(--v-theme-primary)); }
.sticker-zone__remove { position: absolute; right: 7px; top: 7px; border-radius: 100%; background: #1b233d; width: 25px; height: 25px; color: white; display: flex; justify-content: center; align-items: center; }
.sticker-drag-ghost { position: fixed; z-index: 10000; pointer-events: none; transform: translate(-50%, -50%); padding: 10px; color: white; background: #2454b5; border: 1px solid white; border-radius: 12px; }
@media (max-width: 430px) { .sticker-palette { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
