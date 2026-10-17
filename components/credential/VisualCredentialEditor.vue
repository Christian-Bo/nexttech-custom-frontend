<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import type { VisualCredentialDesign, VisualCredentialSticker, VisualCredentialTheme } from '~/utils/credentialVisualDesign'
import { VISUAL_CREDENTIAL_MAX_STICKERS, clampCredentialNumber, normalizeVisualCredentialDesign } from '~/utils/credentialVisualDesign'

type StickerOption = { id: string, name: string }
const props = defineProps<{
  modelValue: VisualCredentialDesign
  portraitUrl: string
  nickname: string
  role: string
  stickerOptions: StickerOption[]
  storageAvailable: boolean
  loaded: boolean
  qrImageUrl: string
  qrReady: boolean
  qrAllowed: boolean
  qrBusy: boolean
}>()
const emit = defineEmits<{
  (e: 'update:modelValue', value: VisualCredentialDesign): void
  (e: 'reset' | 'activateCredential' | 'downloadCredential'): void
}>()

const photoArea = ref<HTMLElement | null>(null)
const selectedPaletteId = ref('')
const selectedUid = ref('')
const dragPoint = ref({ x: 0, y: 0 })
const draggingPalette = ref(false)
const themeChoices: { id: VisualCredentialTheme, name: string, subtitle: string }[] = [
  { id: 'BLUE_NEON', name: 'Blue Neon', subtitle: 'Azul y cian' },
  { id: 'DARK_CARBON', name: 'Dark Carbon', subtitle: 'Negro y plata' },
  { id: 'PURPLE_PULSE', name: 'Purple Pulse', subtitle: 'Morado y violeta' }
]
const selectedSticker = computed(() => props.modelValue.stickers.find(s => s.uid === selectedUid.value) ?? null)
const selectedName = computed(() => props.stickerOptions.find(s => s.id === selectedSticker.value?.stickerId)?.name || selectedSticker.value?.stickerId || '')
const visualStickerOptions = computed(() => props.stickerOptions.filter(s => /^[A-Z0-9_-]{1,48}$/.test(s.id)))
let drag: { source: 'palette' | 'placed', stickerId: string, uid?: string, x: number, y: number, moving: boolean } | null = null
let uidSequence = 0

function iconFor(id: string): string {
  const names: Record<string, string> = {
    STAR: 'mdi-star-four-points', GAMER: 'mdi-gamepad-variant', CODE: 'mdi-code-tags', TECH: 'mdi-laptop'
  }
  return names[id] || 'mdi-sticker-emoji'
}
function change(next: VisualCredentialDesign): void {
  emit('update:modelValue', normalizeVisualCredentialDesign(next))
}
function withStickers(stickers: VisualCredentialSticker[]): void {
  change({ ...props.modelValue, stickers })
}
function themeClass(): string { return `vc-card--${props.modelValue.theme.toLowerCase().replaceAll('_', '-')}` }
function setTheme(theme: VisualCredentialTheme): void { change({ ...props.modelValue, theme }) }
function locationFromEvent(x: number, y: number): { x: number, y: number } | null {
  const rect = photoArea.value?.getBoundingClientRect()
  if (!rect || !rect.width || !rect.height) return null
  return { x: (x - rect.left) / rect.width, y: (y - rect.top) / rect.height }
}
function insidePhoto(x: number, y: number): boolean {
  return x >= 0 && x <= 1 && y >= 0 && y <= 1
}
function insideBounds(x: number, y: number, size: number): { x: number, y: number } {
  const margin = size / 2
  return { x: clampCredentialNumber(x, margin, 1 - margin, 0.5), y: clampCredentialNumber(y, margin, 1 - margin, 0.5) }
}
function addSticker(stickerId: string, x: number, y: number): void {
  if (!visualStickerOptions.value.some(s => s.id === stickerId)) return
  if (props.modelValue.stickers.length >= VISUAL_CREDENTIAL_MAX_STICKERS) return
  const size = 0.18
  const coords = insideBounds(x, y, size)
  // Identificador local de una capa visual; no es identificador de backend.
  const uid = `v${Date.now().toString(36)}_${(++uidSequence).toString(36)}`
  withStickers([...props.modelValue.stickers, { uid, stickerId, ...coords, size, rotation: 0 }])
  selectedUid.value = uid
}
function placeOnPhoto(e: PointerEvent): void {
  if (e.pointerType === 'mouse' && e.button !== 0) return
  if (!selectedPaletteId.value) return
  const loc = locationFromEvent(e.clientX, e.clientY)
  if (loc && insidePhoto(loc.x, loc.y)) addSticker(selectedPaletteId.value, loc.x, loc.y)
}
function updateSticker(uid: string, patch: Partial<VisualCredentialSticker>): void {
  withStickers(props.modelValue.stickers.map(s => {
    if (s.uid !== uid) return s
    const next = { ...s, ...patch }
    return { ...next, ...insideBounds(next.x, next.y, next.size) }
  }))
}
function removeSelected(): void {
  if (!selectedUid.value) return
  withStickers(props.modelValue.stickers.filter(s => s.uid !== selectedUid.value))
  selectedUid.value = ''
}
function clearListeners(): void {
  if (import.meta.client) {
    window.removeEventListener('pointermove', dragMove)
    window.removeEventListener('pointerup', dragEnd)
    window.removeEventListener('pointercancel', cancelDrag)
  }
}
function cancelDrag(): void {
  drag = null
  draggingPalette.value = false
  clearListeners()
}
function beginPaletteDrag(e: PointerEvent, stickerId: string): void {
  if (e.pointerType === 'mouse' && e.button !== 0) return
  selectedPaletteId.value = stickerId
  drag = { source: 'palette', stickerId, x: e.clientX, y: e.clientY, moving: false }
  dragPoint.value = { x: e.clientX, y: e.clientY }
  window.addEventListener('pointermove', dragMove)
  window.addEventListener('pointerup', dragEnd)
  window.addEventListener('pointercancel', cancelDrag)
}
function beginStickerDrag(e: PointerEvent, sticker: VisualCredentialSticker): void {
  if (e.pointerType === 'mouse' && e.button !== 0) return
  e.preventDefault()
  selectedUid.value = sticker.uid
  selectedPaletteId.value = ''
  drag = { source: 'placed', uid: sticker.uid, stickerId: sticker.stickerId, x: e.clientX, y: e.clientY, moving: false }
  window.addEventListener('pointermove', dragMove)
  window.addEventListener('pointerup', dragEnd)
  window.addEventListener('pointercancel', cancelDrag)
}
function dragMove(e: PointerEvent): void {
  if (!drag) return
  if (!drag.moving && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 5) return
  drag.moving = true
  if (drag.source === 'palette') {
    draggingPalette.value = true
    dragPoint.value = { x: e.clientX, y: e.clientY }
  }
  else if (drag.uid) {
    const loc = locationFromEvent(e.clientX, e.clientY)
    if (loc) updateSticker(drag.uid, { x: loc.x, y: loc.y })
  }
}
function dragEnd(e: PointerEvent): void {
  const source = drag
  cancelDrag()
  if (!source || !source.moving || source.source !== 'palette') return
  const loc = locationFromEvent(e.clientX, e.clientY)
  if (loc && insidePhoto(loc.x, loc.y)) addSticker(source.stickerId, loc.x, loc.y)
}
function keyboardMove(e: KeyboardEvent, sticker: VisualCredentialSticker): void {
  const delta = e.shiftKey ? 0.05 : 0.015
  const directions: Record<string, [number, number]> = {
    ArrowLeft: [-delta, 0], ArrowRight: [delta, 0], ArrowUp: [0, -delta], ArrowDown: [0, delta]
  }
  const position = directions[e.key]
  if (!position) return
  e.preventDefault()
  selectedUid.value = sticker.uid
  updateSticker(sticker.uid, { x: sticker.x + position[0], y: sticker.y + position[1] })
}
function onSizeChange(value: string): void {
  if (selectedSticker.value) updateSticker(selectedSticker.value.uid, { size: Number(value) / 100 })
}
function onRotationChange(value: string): void {
  if (selectedSticker.value) updateSticker(selectedSticker.value.uid, { rotation: Number(value) })
}
onBeforeUnmount(() => { cancelDrag() })
</script>

<template>
  <section class="vc-workspace" aria-label="Personalizador visual de credencial">
    <div class="vc-workspace__controls">
      <div class="vc-eyebrow">ESTUDIO DE IDENTIDAD</div>
      <h2 class="vc-heading">Hazla tuya.</h2>
      <p class="vc-muted">Elige colores y coloca stickers libremente sobre tu foto. Tu identificación y tu QR continúan gestionados por NextTech.</p>

      <h3 class="vc-fieldtitle">01 / Elige un estilo</h3>
      <div class="vc-themes" role="group" aria-label="Tema de la credencial">
        <button v-for="theme in themeChoices" :key="theme.id" type="button" class="vc-theme" :class="[`vc-theme--${theme.id.toLowerCase().replaceAll('_', '-')}`, { 'vc-theme--active': modelValue.theme === theme.id }]" :aria-pressed="modelValue.theme === theme.id" @click="setTheme(theme.id)">
          <span class="vc-theme__swatch" aria-hidden="true" />
          <span class="vc-theme__labels"><strong>{{ theme.name }}</strong><small>{{ theme.subtitle }}</small></span>
          <v-icon v-if="modelValue.theme === theme.id" icon="mdi-check-circle" color="info" size="19" />
        </button>
      </div>

      <div class="vc-section-heading">
        <h3 class="vc-fieldtitle">02 / Tus stickers</h3>
        <span class="vc-counter">{{ modelValue.stickers.length }}/{{ VISUAL_CREDENTIAL_MAX_STICKERS }}</span>
      </div>
      <p class="vc-muted vc-muted--small">Pulsa un ícono y toca cualquier punto de la foto. También puedes arrastrar desde aquí y moverlo después.</p>
      <div class="vc-palette" role="group" aria-label="Stickers disponibles">
        <button v-for="item in visualStickerOptions" :key="item.id" class="vc-palette__item" :class="{ 'vc-palette__item--selected': selectedPaletteId === item.id }" type="button" :aria-pressed="selectedPaletteId === item.id" :disabled="modelValue.stickers.length >= VISUAL_CREDENTIAL_MAX_STICKERS" @click="selectedPaletteId = item.id" @pointerdown="beginPaletteDrag($event, item.id)">
          <v-icon :icon="iconFor(item.id)" size="27" />
          <span>{{ item.name }}</span>
        </button>
      </div>
      <p v-if="!visualStickerOptions.length" class="vc-muted vc-muted--small">No hay stickers disponibles en la configuración oficial.</p>
      <p v-if="modelValue.stickers.length >= VISUAL_CREDENTIAL_MAX_STICKERS" class="vc-limit">Alcanzaste el máximo visual. Elimina uno para agregar otro.</p>

      <div v-if="selectedSticker" class="vc-adjust">
        <div class="vc-section-heading"><h3 class="vc-fieldtitle">Ajustar {{ selectedName }}</h3><button type="button" class="vc-link vc-link--danger" @click="removeSelected"><v-icon icon="mdi-delete-outline" size="17" /> Quitar</button></div>
        <label class="vc-range-label" for="vc-sticker-size">Tamaño <strong>{{ Math.round(selectedSticker.size * 100) }}%</strong></label>
        <input id="vc-sticker-size" class="vc-range" type="range" min="9" max="36" step="1" :value="Math.round(selectedSticker.size * 100)" @input="onSizeChange(($event.target as HTMLInputElement).value)">
        <label class="vc-range-label" for="vc-sticker-rotate">Rotación <strong>{{ selectedSticker.rotation }}°</strong></label>
        <input id="vc-sticker-rotate" class="vc-range" type="range" min="-180" max="180" step="5" :value="selectedSticker.rotation" @input="onRotationChange(($event.target as HTMLInputElement).value)">
      </div>
      <p v-else class="vc-tip"><v-icon icon="mdi-gesture-tap" size="17" /> Toca un sticker colocado para ajustar su tamaño o rotación. Con el teclado puedes moverlo usando las flechas.</p>

      <div class="vc-qr-control">
        <h3 class="vc-fieldtitle">03 / Tu credencial QR</h3>
        <p v-if="!qrReady" class="vc-muted vc-muted--small">El código se genera y activa directamente en NextTech. Al crear uno nuevo, el anterior queda invalidado. No necesitas subir ninguna fotografía ni captura.</p>
        <p v-else class="vc-muted vc-muted--small">Tu QR está activo. Puedes cambiar tu diseño y descargar otro PDF sin generar un código diferente.</p>
        <button v-if="!qrReady" class="vc-qr-upload" type="button" :disabled="qrBusy || !qrAllowed" @click="emit('activateCredential')">
          <v-icon icon="mdi-shield-check-outline" size="20" /> {{ qrBusy ? 'Activando…' : 'Activar y descargar mi credencial' }}
        </button>
        <button v-else class="vc-qr-upload" type="button" :disabled="qrBusy || !portraitUrl" @click="emit('downloadCredential')">
          <v-icon icon="mdi-file-pdf-box" size="20" /> {{ qrBusy ? 'Preparando PDF…' : 'Descargar mi credencial (PDF)' }}
        </button>
        <p v-if="!qrAllowed" class="vc-qr-note">Para activar el QR se requiere confirmar tu enrolamiento y fotografía en el backend.</p>
        <p class="vc-qr-note">Conserva el PDF descargado: contiene tu QR de acceso vigente. El código no se guarda en el navegador ni se envía automáticamente al correo.</p>
      </div>

      <div class="vc-storage-note">
        <v-icon :icon="storageAvailable ? 'mdi-content-save-check-outline' : 'mdi-alert-outline'" size="20" />
        <span v-if="!loaded">Cargando el diseño de esta cuenta…</span>
        <span v-else-if="storageAvailable">Diseño visual guardado automáticamente en este navegador, para esta cuenta.</span>
        <span v-else>El navegador bloquea el almacenamiento: los cambios podrían perderse al cerrar.</span>
      </div>
      <button type="button" class="vc-link vc-reset" @click="emit('reset')"><v-icon icon="mdi-restore" size="17" /> Restaurar diseño visual</button>
    </div>

    <div class="vc-workspace__preview">
      <div class="vc-preview-heading"><span>TU CREDENCIAL NEXTTECH</span><span class="vc-preview-live"><span /> Diseño en vivo</span></div>
      <div class="vc-card" :class="themeClass()" aria-label="Tu credencial digital personalizada">
        <div class="vc-card__lights" aria-hidden="true" />
        <header class="vc-card__header"><span class="vc-card__symbol">N<span>✦</span></span><div><strong>NextTech <span>Custom</span></strong><small>CREDENCIAL DIGITAL</small></div><span class="vc-card__edition">MI IDENTIDAD</span></header>
        <div class="vc-card__topline" aria-hidden="true" />
        <div class="vc-photo-shell">
          <div ref="photoArea" class="vc-photo" aria-label="Fotografía y área libre de stickers" @pointerdown="placeOnPhoto">
            <img v-if="portraitUrl" :src="portraitUrl" alt="Fotografía oficial obtenida del backend" draggable="false">
            <div v-else class="vc-photo__empty"><v-icon icon="mdi-account-circle-outline" size="69"/><span>Fotografía no disponible</span></div>
            <button v-for="sticker in modelValue.stickers" :key="sticker.uid" type="button" class="vc-photo-sticker" :class="{ 'vc-photo-sticker--selected': selectedUid === sticker.uid }" :aria-label="`Sticker ${sticker.stickerId}; arrastrar o usar flechas para mover`" :style="{ left: `${sticker.x * 100}%`, top: `${sticker.y * 100}%`, width: `${sticker.size * 100}%`, transform: `translate(-50%, -50%) rotate(${sticker.rotation}deg)` }" @pointerdown.stop="beginStickerDrag($event, sticker)" @click.stop="selectedUid = sticker.uid" @keydown="keyboardMove($event, sticker)">
              <v-icon class="vc-photo-sticker__icon" :icon="iconFor(sticker.stickerId)" />
            </button>
          </div>
        </div>
        <div class="vc-card__identity"><p class="vc-card__role-label">IDENTIDAD DEL COMPRADOR</p><h3>{{ nickname || 'Comprador NextTech' }}</h3><span class="vc-card__role"><v-icon icon="mdi-shield-check-outline" size="14"/> {{ role || 'COMPRADOR' }}</span></div>
        <div class="vc-card__qr-section" aria-label="Código QR de la credencial">
          <div v-if="qrImageUrl" class="vc-card__qr-real">
            <img :src="qrImageUrl" alt="Código QR generado y activado por NextTech" draggable="false">
          </div>
          <div v-else class="vc-card__qr-missing">
            <v-icon icon="mdi-shield-lock-outline" size="27" />
            <span>Activa tu credencial para obtener un nuevo QR de acceso.</span>
          </div>
        </div>
        <div class="vc-card__rule" />
        <footer class="vc-card__footer"><div class="vc-card__footer-icon"><v-icon icon="mdi-fingerprint" size="28" /></div><div><strong>Tu estilo. Tu identidad.</strong><small>Foto y datos oficiales del servidor</small></div><span class="vc-card__side">NT / 01</span></footer>
      </div>
      <p class="vc-preview-foot"><v-icon icon="mdi-information-outline" size="17" /> Tu fotografía y nombre provienen del backend. Cuando activas la credencial, el QR se genera y valida en NextTech; el estilo y los stickers son visuales.</p>
    </div>
    <div v-if="draggingPalette" class="vc-drag-preview" :style="{ left: `${dragPoint.x}px`, top: `${dragPoint.y}px` }" aria-hidden="true"><v-icon :icon="iconFor(selectedPaletteId)" size="31" /></div>
  </section>
</template>

<style scoped>
.vc-workspace {
  display: grid;
  grid-template-columns: minmax(260px,.88fr) minmax(300px,1.1fr);
  gap: 28px;
  color: #eff6ff;
}

.vc-workspace__controls {
  background: #18253d;
  border: 1px solid rgba(165,199,255,.17);
  border-radius: 22px;
  padding: 24px;
  align-self: start;
}

.vc-eyebrow {
  font-size: 10px;
  letter-spacing: .22em;
  font-weight: 800;
  color: #59d0ff;
}

.vc-heading {
  font-weight: 820;
  font-size: clamp(24px,3vw,33px);
  line-height: 1.15;
  margin: 8px 0 10px;
}

.vc-muted {
  font-size: 13px;
  line-height: 1.6;
  color: #b2c1d8;
  margin: 0;
}

.vc-muted--small {
  font-size: 12px;
  margin: 8px 0 12px;
}

.vc-fieldtitle {
  font-size: 12px;
  letter-spacing: .045em;
  font-weight: 800;
  margin: 24px 0 12px;
}

.vc-section-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.vc-section-heading .vc-fieldtitle {
  margin-bottom: 4px;
}

.vc-counter {
  font-size: 11px;
  color: #9cafd1;
  font-weight: 800;
}

.vc-themes {
  display: grid;
  gap: 8px;
}

.vc-theme {
  display: flex;
  align-items: center;
  text-align: left;
  gap: 11px;
  border: 1px solid #42536e;
  background: #1c2c45;
  color: #f7faff;
  border-radius: 12px;
  padding: 9px 12px;
  min-height: 58px;
  cursor: pointer;
}

.vc-theme--active {
  border-color: #38beff;
  box-shadow: 0 0 0 1px #38beff55;
  background: #233854;
}

.vc-theme__swatch {
  width: 32px;
  height: 32px;
  border-radius: 9px;
  flex: none;
  background: linear-gradient(135deg,#1d6aff,#00d9eb);
}

.vc-theme--dark-carbon .vc-theme__swatch {
  background: linear-gradient(135deg,#5c687b,#070b14);
}

.vc-theme--purple-pulse .vc-theme__swatch {
  background: linear-gradient(135deg,#a855f7,#3423a7);
}

.vc-theme__labels {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.vc-theme__labels strong {
  font-size: 12px;
}

.vc-theme__labels small {
  color: #adbeda;
  font-size: 10px;
}

.vc-palette {
  display: grid;
  grid-template-columns: repeat(4,minmax(0,1fr));
  gap: 8px;
}

.vc-palette__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  background: #253753;
  border: 1px solid #49607f;
  color: #eaf5ff;
  border-radius: 12px;
  padding: 12px 3px 10px;
  font-size: 10px;
  line-height: 1.3;
  cursor: grab;
  touch-action: none;
  min-width: 0;
}

.vc-palette__item span {
  overflow-wrap: anywhere;
}

.vc-palette__item--selected {
  border-color: #36c7f8;
  background: #254c72;
  box-shadow: 0 0 0 1px #36c7f857;
}

.vc-palette__item:disabled {
  opacity: .4;
  cursor: not-allowed;
}

.vc-limit {
  font-size: 11px;
  color: #ffc48d;
  margin-top: 9px;
}

.vc-adjust {
  margin-top: 20px;
  border: 1px solid #39516d;
  padding: 14px 16px;
  border-radius: 14px;
  background: #142339;
}

.vc-adjust .vc-fieldtitle {
  margin: 0;
}

.vc-range-label {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  margin: 14px 0 5px;
  color: #cbd9ed;
}

.vc-range-label strong {
  color: #f6fbff;
}

.vc-range {
  width: 100%;
  accent-color: #38c8f6;
  cursor: pointer;
}

.vc-link {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: #8bdbff;
  background: transparent;
  border: 0;
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;
}

.vc-link--danger {
  color: #ff999c;
}

.vc-tip {
  display: flex;
  align-items: start;
  gap: 6px;
  color: #bdcae0;
  font-size: 11px;
  margin-top: 16px;
  line-height: 1.6;
}

.vc-storage-note {
  display: flex;
  align-items: start;
  gap: 9px;
  margin-top: 22px;
  font-size: 11px;
  line-height: 1.45;
  color: #a5d9e6;
  background: #133244;
  padding: 12px;
  border: 1px solid #21566d;
  border-radius: 12px;
}

.vc-reset {
  margin-top: 14px;
}

.vc-workspace__preview {
  background: radial-gradient(ellipse at 50% 14%,#174276 0%,#101c32 58%,#10192b 100%);
  border-radius: 22px;
  border: 1px solid #26476c;
  padding: 18px 19px 22px;
  display: flex;
  align-items: center;
  flex-direction: column;
  min-width: 0;
}

.vc-preview-heading {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 7px;
  color: #a3b9d7;
  font-weight: 750;
  font-size: 10px;
  letter-spacing: .13em;
  margin-bottom: 24px;
}

.vc-preview-live {
  letter-spacing: 0;
  text-transform: none;
  font-weight: 650;
  color: #73e5c8;
  display: flex;
  align-items: center;
  gap: 6px;
}

.vc-preview-live span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #4adeb4;
  box-shadow: 0 0 10px #4adeb4;
}

.vc-card {
  position: relative;
  isolation: isolate;
  width: min(100%,366px);
  aspect-ratio: 3/5.05;
  border-radius: 19px;
  overflow: hidden;
  padding: 0 24px 18px;
  display: flex;
  flex-direction: column;
  align-items: center;
  color: white;
  border: 1px solid #5bbcff88;
  box-shadow: 0 26px 54px #0008,0 0 31px #0089ff2b;
  background: linear-gradient(160deg,#1766ed 0 13%,#0c1530 13% 100%);
}

.vc-card--dark-carbon {
  border-color: #cbd5e188;
  box-shadow: 0 26px 54px #0009,0 0 20px #b2bbc41e;
  background: linear-gradient(160deg,#4c586a 0 13%,#0c111b 13% 100%);
}

.vc-card--purple-pulse {
  border-color: #bb8cff88;
  box-shadow: 0 26px 54px #0009,0 0 25px #ba5cff25;
  background: linear-gradient(160deg,#7c3aed 0 13%,#1c123e 13% 100%);
}

.vc-card__lights {
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background: radial-gradient(circle at 85% 42%,#08bff515,transparent 47%),radial-gradient(circle at 14% 85%,#597fff21,transparent 45%);
}

.vc-card__header {
  width: 100%;
  height: 69px;
  display: flex;
  align-items: center;
  gap: 9px;
  position: relative;
}

.vc-card__symbol {
  width: 31px;
  height: 31px;
  display: grid;
  place-items: center;
  background: #ffffff22;
  border: 1px solid #ffffff55;
  border-radius: 10px;
  font-weight: 900;
  font-size: 16px;
}

.vc-card__symbol span {
  color: #7ef3ff;
  font-size: 12px;
}

.vc-card__header>div {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.vc-card__header strong {
  font-size: 12px;
  line-height: 1.3;
}

.vc-card__header strong span {
  font-weight: 450;
  color: #d5e9ff;
}

.vc-card__header small {
  font-size: 8px;
  font-weight: 850;
  letter-spacing: .16em;
  color: #c5e1ff;
}

.vc-card__edition {
  margin-left: auto;
  border: 1px solid #ffffff55;
  border-radius: 999px;
  padding: 4px 7px;
  font-size: 7px;
  letter-spacing: .08em;
  white-space: nowrap;
  color: #f3f8ff;
}

.vc-card__topline {
  width: 100%;
  height: 1px;
  background: linear-gradient(90deg,transparent,#ffffff70,transparent);
}

.vc-photo-shell {
  border-radius: 17px;
  border: 2px solid #57e0f3;
  padding: 5px;
  background: #0b1830;
  box-shadow: 0 0 20px #00daf135;
  margin-top: 15px;
  width: 63%;
  aspect-ratio: 1/1;
}

.vc-card--dark-carbon .vc-photo-shell {
  border-color: #b9ccde;
  box-shadow: 0 0 14px #e2ebff25;
}

.vc-card--purple-pulse .vc-photo-shell {
  border-color: #d6a7ff;
  box-shadow: 0 0 20px #bc6dff33;
}

.vc-photo {
  position: relative;
  isolation: isolate;
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 11px;
  overflow: hidden;
  background: #23344e;
  touch-action: none;
  cursor: crosshair;
}

.vc-photo>img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  user-select: none;
  pointer-events: none;
}

.vc-photo__empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  color: #b0c3dc;
  font-size: 10px;
}

.vc-photo-sticker {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 50%;
  background: #0004;
  cursor: grab;
  color: #fff6a9;
  text-shadow: 0 2px 5px #000;
  filter: drop-shadow(0 2px 4px #000b);
  padding: 1px;
  touch-action: none;
  aspect-ratio: 1/1;
}

.vc-photo-sticker {
  container-type: inline-size;
}

.vc-photo-sticker__icon {
  font-size: 78cqw !important;
  width: 100%;
  height: 100%;
}

.vc-photo-sticker:focus-visible,.vc-photo-sticker--selected {
  outline: 2px solid #7becff;
  outline-offset: 2px;
  background: #013c6380;
}

.vc-photo-sticker:active {
  cursor: grabbing;
}

.vc-card__identity {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  margin-top: 20px;
  min-width: 0;
  max-width: 100%;
}

.vc-card__role-label {
  font-size: 8px;
  letter-spacing: .21em;
  color: #a9c7e9;
  font-weight: 800;
}

.vc-card__identity h3 {
  font-size: clamp(15px,2.7vw,22px);
  font-weight: 850;
  line-height: 1.25;
  overflow-wrap: anywhere;
  max-width: 100%;
  text-shadow: 0 2px 12px #0006;
}

.vc-card__role {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  letter-spacing: .12em;
  font-weight: 850;
  color: #75eeff;
}

.vc-card__rule {
  margin-top: auto;
  height: 1px;
  width: 100%;
  background: linear-gradient(90deg,transparent,#ffffff61,transparent);
}

.vc-card__footer {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding-top: 12px;
}

.vc-card__footer-icon {
  color: #86e4fa;
}

.vc-card__footer>div:nth-child(2) {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.vc-card__footer strong {
  font-size: 11px;
}

.vc-card__footer small {
  font-size: 8px;
  color: #afc2df;
}

.vc-card__side {
  margin-left: auto;
  color: #95aac6;
  letter-spacing: .1em;
  font-size: 8px;
  white-space: nowrap;
}

.vc-preview-foot {
  margin-top: 21px;
  max-width: 367px;
  color: #acc3df;
  font-size: 11px;
  line-height: 1.5;
  display: flex;
  align-items: start;
  gap: 7px;
}

.vc-drag-preview {
  position: fixed;
  z-index: 10000;
  pointer-events: none;
  transform: translate(-50%,-50%);
  border-radius: 50%;
  padding: 9px;
  background: #1d4f97eb;
  color: #fff9b2;
  border: 1px solid #8bf3ff;
  box-shadow: 0 8px 22px #0008;
}

.vc-palette__item:focus-visible,.vc-theme:focus-visible,.vc-link:focus-visible {
  outline: 2px solid #6bd7ff;
  outline-offset: 3px;
}

@media (max-width:980px) {
  .vc-workspace {
    grid-template-columns: minmax(0,1fr);
  }
  .vc-workspace__preview {
    order: -1;
  }
  .vc-card {
    max-width: 350px;
  }
  .vc-workspace__controls {
    padding: 21px;
  }
}

@media (max-width:520px) {
  .vc-preview-heading {
    font-size: 9px;
  }
  .vc-workspace__preview {
    padding: 15px 10px 18px;
  }
  .vc-card {
    width: min(100%,320px);
    padding-left: 17px;
    padding-right: 17px;
  }
  .vc-palette {
    grid-template-columns: repeat(4,minmax(0,1fr));
  }
  .vc-workspace__controls {
    padding: 16px;
  }
}

/* El QR real se incorpora en memoria, sin cambiar el contrato de autenticación. */
.vc-qr-control{margin-top:24px;padding:16px;border-radius:15px;border:1px solid #345675;background:linear-gradient(140deg,#12304d,#17263b)}
.vc-qr-control .vc-fieldtitle{margin:0 0 9px}
.vc-qr-file{position:absolute;width:1px;height:1px;opacity:0;overflow:hidden;pointer-events:none}
.vc-qr-upload{display:inline-flex;align-items:center;gap:9px;border:1px solid #77ccee;background:#173e63;border-radius:11px;color:#e6f8ff;font-size:12px;font-weight:750;padding:10px 13px;margin-top:10px;cursor:pointer}
.vc-qr-upload:hover,.vc-qr-upload:focus-visible{background:#1e507c}
.vc-qr-remove{margin:10px 0 0 13px}
.vc-qr-error{font-size:12px;color:#ffb4b4;line-height:1.4;margin-top:10px}
.vc-qr-note{color:#8eafcb;font-size:10px;line-height:1.5;margin:10px 0 0}
.vc-card__qr-section{margin:11px 0 7px;display:grid;place-items:center;min-height:100px;width:100%}
.vc-card__qr-real{padding:7px;border:2px solid #dce9f6;background:#fff;border-radius:12px;box-shadow:0 6px 16px #0005;width:112px;height:112px}
.vc-card__qr-real img{width:100%;height:100%;object-fit:contain;display:block}
.vc-card__qr-missing{width:min(100%,225px);min-height:90px;padding:12px;border:1px dashed #bcd8fa5c;border-radius:12px;background:#ffffff0d;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;text-align:center;color:#e1ebfb}
.vc-card__qr-missing span{font-size:10px;line-height:1.4}
</style>
