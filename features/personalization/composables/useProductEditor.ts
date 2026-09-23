import { computed, getCurrentScope, onScopeDispose, ref, shallowRef } from 'vue'
import type { Canvas, FabricObject } from 'fabric'
import type {
  DesignExport,
  DesignJson,
  EditorObjectKind,
  ImageFilterName,
  ProductTemplate,
  SideKey,
  ZoneDesignJson
} from '../types/editor'
import { MAX_STICKERS_PER_SIDE } from '../types/editor'
import { fileService } from '~/services/fileService'
import { processImage } from '~/utils/image'

type FabricModule = typeof import('fabric')

/** Propiedades propias que se guardan en el JSON de Fabric. */
const CUSTOM_PROPS = ['ntKind', 'fileId', 'ntFilter']
const MAX_HISTORY = 50
const AUTOSAVE_DELAY_MS = 800
const DEFAULT_BACKGROUND = '#FFFFFF'

type NtObject = FabricObject & {
  ntKind?: EditorObjectKind
  fileId?: string
  ntFilter?: ImageFilterName
}

interface SideRuntime {
  canvas: Canvas
  history: string[]
  index: number
}

export interface TextStyle {
  fontFamily: string
  fill: string
  fontSize: number
  fontWeight: string | number
  textAlign: string
}

export interface EditorSelection {
  kind: EditorObjectKind | null
  count: number
  text?: TextStyle
  filter?: ImageFilterName
}

const OBJECT_STYLE = {
  borderColor: '#06B6D4',
  cornerColor: '#2563EB',
  cornerStrokeColor: '#F8FAFC',
  cornerStyle: 'circle' as const,
  cornerSize: 14,
  transparentCorners: false,
  borderScaleFactor: 2,
  padding: 6
}

/**
 * Motor del editor (client-only). Un canvas de Fabric por lado (A/B) para
 * permitir el flip animado; historial undo/redo independiente por lado;
 * autosave a localStorage con referencias a archivos (nunca Data URLs).
 */
export function useProductEditor(template: ProductTemplate) {
  let fabric: FabricModule | null = null
  const sides: Partial<Record<SideKey, SideRuntime>> = {}
  const objectUrls = new Set<string>()
  let restoring = false
  let autosaveTimer: ReturnType<typeof setTimeout> | null = null

  const sideKeys = template.zones.map(z => z.key)
  const activeSide = ref<SideKey>(sideKeys[0] ?? 'A')
  const isReady = ref(false)
  const isBusy = ref(false)
  const hasChanges = ref(false)
  const lastSavedAt = ref<Date | null>(null)
  const selection = shallowRef<EditorSelection>({ kind: null, count: 0 })
  const historyVersion = ref(0)

  const draftKey = `nt-editor-draft:${template.code}`

  const current = () => sides[activeSide.value]

  const canUndo = computed(() => {
    void historyVersion.value
    const rt = current()
    return !!rt && rt.index > 0
  })

  const canRedo = computed(() => {
    void historyVersion.value
    const rt = current()
    return !!rt && rt.index < rt.history.length - 1
  })

  // ---------- helpers ----------

  function createObjectUrl(blob: Blob): string {
    const url = URL.createObjectURL(blob)
    objectUrls.add(url)
    return url
  }

  function buildClipPath(f: FabricModule) {
    const { width, height, shape } = template
    if (shape === 'CIRCULAR') {
      return new f.Circle({ radius: width / 2, left: 0, top: 0, originX: 'left', originY: 'top', absolutePositioned: true })
    }
    const r = template.cornerRadius ?? 0
    return new f.Rect({ width, height, rx: r, ry: r, left: 0, top: 0, originX: 'left', originY: 'top', absolutePositioned: true })
  }

  function styleObject(obj: FabricObject): void {
    obj.set(OBJECT_STYLE)
  }

  function snapshot(rt: SideRuntime): string {
    return JSON.stringify(rt.canvas.toObject(CUSTOM_PROPS))
  }

  function scheduleAutosave(): void {
    if (autosaveTimer) clearTimeout(autosaveTimer)
    autosaveTimer = setTimeout(saveDraft, AUTOSAVE_DELAY_MS)
  }

  function record(side: SideKey = activeSide.value): void {
    const rt = sides[side]
    if (!rt || restoring) return
    const snap = snapshot(rt)
    if (rt.history[rt.index] === snap) return
    rt.history = rt.history.slice(0, rt.index + 1)
    rt.history.push(snap)
    if (rt.history.length > MAX_HISTORY) rt.history.shift()
    rt.index = rt.history.length - 1
    historyVersion.value++
    hasChanges.value = true
    scheduleAutosave()
  }

  function readSelection(): void {
    const canvas = current()?.canvas
    const active = canvas?.getActiveObjects() ?? []
    if (!canvas || active.length === 0) {
      selection.value = { kind: null, count: 0 }
      return
    }
    const obj = active[0] as NtObject
    const info: EditorSelection = { kind: active.length > 1 ? null : obj.ntKind ?? 'shape', count: active.length }
    if (info.kind === 'text') {
      const t = obj as NtObject & Partial<TextStyle>
      info.text = {
        fontFamily: String(t.fontFamily ?? 'Inter'),
        fill: String(t.fill ?? '#0F172A'),
        fontSize: Number(t.fontSize ?? 48),
        fontWeight: t.fontWeight ?? 'normal',
        textAlign: String(t.textAlign ?? 'center')
      }
    }
    if (info.kind === 'image') info.filter = obj.ntFilter ?? 'none'
    selection.value = info
  }

  function bindEvents(side: SideKey, canvas: Canvas): void {
    const onChange = () => record(side)
    canvas.on('object:added', onChange)
    canvas.on('object:modified', onChange)
    canvas.on('object:removed', onChange)
    canvas.on('text:editing:exited', onChange)
    canvas.on('selection:created', readSelection)
    canvas.on('selection:updated', readSelection)
    canvas.on('selection:cleared', readSelection)
  }

  async function loadSnapshot(rt: SideRuntime, json: string | Record<string, unknown>): Promise<void> {
    restoring = true
    try {
      await rt.canvas.loadFromJSON(json)
      if (fabric) rt.canvas.clipPath = buildClipPath(fabric)
      rt.canvas.getObjects().forEach(styleObject)
      rt.canvas.requestRenderAll()
    }
    finally {
      restoring = false
    }
    readSelection()
  }

  // ---------- ciclo de vida ----------

  async function mount(elements: Partial<Record<SideKey, HTMLCanvasElement>>, displayWidth: number): Promise<void> {
    fabric = await import('fabric')
    const f = fabric
    for (const key of sideKeys) {
      const el = elements[key]
      if (!el) continue
      const canvas = new f.Canvas(el, {
        preserveObjectStacking: true,
        backgroundColor: DEFAULT_BACKGROUND,
        selectionColor: 'rgba(6, 182, 212, 0.12)',
        selectionBorderColor: '#06B6D4'
      })
      canvas.clipPath = buildClipPath(f)
      const rt: SideRuntime = { canvas, history: [], index: -1 }
      sides[key] = rt
      bindEvents(key, canvas)
      rt.history = [snapshot(rt)]
      rt.index = 0
    }
    resize(displayWidth)
    isReady.value = true
    historyVersion.value++
  }

  function resize(displayWidth: number): void {
    const zoom = displayWidth / template.width
    for (const rt of Object.values(sides)) {
      rt.canvas.setDimensions({ width: displayWidth, height: Math.round(template.height * zoom) })
      rt.canvas.setZoom(zoom)
      rt.canvas.requestRenderAll()
    }
  }

  function setSide(side: SideKey): void {
    if (!sides[side] || side === activeSide.value) return
    current()?.canvas.discardActiveObject()
    current()?.canvas.requestRenderAll()
    activeSide.value = side
    readSelection()
    historyVersion.value++
  }

  async function dispose(): Promise<void> {
    if (autosaveTimer) {
      clearTimeout(autosaveTimer)
      saveDraft()
    }
    for (const rt of Object.values(sides)) await rt.canvas.dispose()
    objectUrls.forEach(url => URL.revokeObjectURL(url))
    objectUrls.clear()
    isReady.value = false
  }

  // ---------- agregar contenido ----------

  function addToCanvas(obj: NtObject): void {
    const canvas = current()?.canvas
    if (!canvas) return
    styleObject(obj)
    restoring = true
    canvas.add(obj)
    restoring = false
    canvas.viewportCenterObject(obj)
    obj.setCoords()
    canvas.setActiveObject(obj)
    canvas.requestRenderAll()
    record()
    readSelection()
  }

  function addText(text = 'Tu texto'): void {
    if (!fabric) return
    const obj = new fabric.Textbox(text, {
      width: template.width * 0.6,
      fontSize: Math.round(template.width * 0.08),
      fontFamily: 'Inter',
      fontWeight: '700',
      fill: '#0F172A',
      textAlign: 'center',
      originX: 'center',
      originY: 'center'
    }) as NtObject
    obj.ntKind = 'text'
    addToCanvas(obj)
  }

  /** Devuelve false si el lado ya tiene el máximo de stickers permitido. */
  function addSticker(emoji: string): boolean {
    if (!fabric) return false
    const count = current()?.canvas.getObjects().filter(o => (o as NtObject).ntKind === 'sticker').length ?? 0
    if (count >= MAX_STICKERS_PER_SIDE) return false
    const obj = new fabric.FabricText(emoji, {
      fontSize: Math.round(template.width * 0.18),
      originX: 'center',
      originY: 'center'
    }) as NtObject
    obj.ntKind = 'sticker'
    addToCanvas(obj)
    return true
  }

  /** Procesa (valida, orienta, comprime), sube vía fileService y agrega al lado activo. */
  async function addImage(file: Blob): Promise<void> {
    if (!fabric) return
    isBusy.value = true
    try {
      const processed = await processImage(file)
      const { fileId } = await fileService.upload(processed)
      const img = await fabric.FabricImage.fromURL(createObjectUrl(processed)) as NtObject
      const maxW = template.width * 0.7
      const maxH = template.height * 0.7
      const scale = Math.min(1, maxW / (img.width || maxW), maxH / (img.height || maxH))
      img.set({ originX: 'center', originY: 'center', scaleX: scale, scaleY: scale })
      img.ntKind = 'image'
      img.fileId = fileId
      img.ntFilter = 'none'
      addToCanvas(img)
    }
    finally {
      isBusy.value = false
    }
  }

  function setBackground(color: string): void {
    const canvas = current()?.canvas
    if (!canvas) return
    canvas.backgroundColor = color
    canvas.requestRenderAll()
    record()
  }

  // ---------- edición de la selección ----------

  function activeObject(): NtObject | undefined {
    return current()?.canvas.getActiveObject() as NtObject | undefined
  }

  function updateText(style: Partial<TextStyle>): void {
    const obj = activeObject()
    if (!obj || obj.ntKind !== 'text') return
    obj.set(style)
    obj.setCoords()
    current()?.canvas.requestRenderAll()
    record()
    readSelection()
  }

  function applyFilter(name: ImageFilterName): void {
    const obj = activeObject() as (NtObject & { filters: unknown[], applyFilters: () => void }) | undefined
    if (!fabric || !obj || obj.ntKind !== 'image') return
    const f = fabric.filters
    const map: Record<ImageFilterName, () => unknown[]> = {
      none: () => [],
      grayscale: () => [new f.Grayscale()],
      sepia: () => [new f.Sepia()],
      vintage: () => [new f.Vintage()],
      bright: () => [new f.Brightness({ brightness: 0.12 }), new f.Contrast({ contrast: 0.12 })]
    }
    obj.filters = map[name]()
    obj.applyFilters()
    obj.ntFilter = name
    current()?.canvas.requestRenderAll()
    record()
    readSelection()
  }

  function removeSelected(): void {
    const canvas = current()?.canvas
    if (!canvas) return
    const objs = canvas.getActiveObjects()
    if (objs.length === 0) return
    canvas.discardActiveObject()
    restoring = true
    objs.forEach(o => canvas.remove(o))
    restoring = false
    canvas.requestRenderAll()
    record()
    readSelection()
  }

  async function duplicateSelected(): Promise<void> {
    const canvas = current()?.canvas
    const obj = activeObject()
    if (!canvas || !obj) return
    const clone = await obj.clone(CUSTOM_PROPS) as NtObject
    clone.set({ left: (obj.left ?? 0) + 30, top: (obj.top ?? 0) + 30 })
    styleObject(clone)
    restoring = true
    canvas.add(clone)
    restoring = false
    canvas.setActiveObject(clone)
    canvas.requestRenderAll()
    record()
  }

  function bringForward(): void {
    const canvas = current()?.canvas
    const obj = activeObject()
    if (!canvas || !obj) return
    canvas.bringObjectForward(obj)
    canvas.requestRenderAll()
    record()
  }

  function sendBackward(): void {
    const canvas = current()?.canvas
    const obj = activeObject()
    if (!canvas || !obj) return
    canvas.sendObjectBackwards(obj)
    canvas.requestRenderAll()
    record()
  }

  function centerSelected(): void {
    const canvas = current()?.canvas
    const obj = activeObject()
    if (!canvas || !obj) return
    canvas.viewportCenterObject(obj)
    obj.setCoords()
    canvas.requestRenderAll()
    record()
  }

  async function clearSide(): Promise<void> {
    const rt = current()
    if (!rt || !fabric) return
    restoring = true
    rt.canvas.clear()
    rt.canvas.backgroundColor = DEFAULT_BACKGROUND
    rt.canvas.clipPath = buildClipPath(fabric)
    restoring = false
    rt.canvas.requestRenderAll()
    record()
    readSelection()
  }

  // ---------- undo / redo ----------

  async function undo(): Promise<void> {
    const rt = current()
    if (!rt || rt.index <= 0) return
    rt.index--
    await loadSnapshot(rt, rt.history[rt.index]!)
    historyVersion.value++
    hasChanges.value = true
    scheduleAutosave()
  }

  async function redo(): Promise<void> {
    const rt = current()
    if (!rt || rt.index >= rt.history.length - 1) return
    rt.index++
    await loadSnapshot(rt, rt.history[rt.index]!)
    historyVersion.value++
    hasChanges.value = true
    scheduleAutosave()
  }

  // ---------- serialización ----------

  /** JSON persistible: imágenes sin `src`, solo con `fileId`. */
  function serialize(): DesignJson {
    const zones: DesignJson['zones'] = {}
    for (const key of sideKeys) {
      const rt = sides[key]
      if (!rt) continue
      const obj = rt.canvas.toObject(CUSTOM_PROPS) as Record<string, unknown> & { objects?: Record<string, unknown>[] }
      obj.objects = (obj.objects ?? []).map(o =>
        String(o.type).toLowerCase() === 'image' ? { ...o, src: '' } : o
      )
      zones[key] = { version: 1, width: template.width, height: template.height, fabric: obj } satisfies ZoneDesignJson
    }
    return { productCode: template.code, updatedAt: new Date().toISOString(), zones }
  }

  /** Carga un diseño guardado resolviendo cada `fileId` a una URL local. */
  async function restore(design: DesignJson): Promise<void> {
    for (const key of sideKeys) {
      const rt = sides[key]
      const zone = design.zones[key]
      if (!rt || !zone) continue
      const json = structuredClone(zone.fabric) as Record<string, unknown> & { objects?: Record<string, unknown>[] }
      const objects: Record<string, unknown>[] = []
      for (const o of json.objects ?? []) {
        if (String(o.type).toLowerCase() !== 'image') {
          objects.push(o)
          continue
        }
        const blob = typeof o.fileId === 'string' ? await fileService.get(o.fileId) : null
        if (blob) objects.push({ ...o, src: createObjectUrl(blob) })
      }
      json.objects = objects
      await loadSnapshot(rt, json)
      rt.history = [snapshot(rt)]
      rt.index = 0
    }
    historyVersion.value++
  }

  function saveDraft(): void {
    autosaveTimer = null
    if (!isReady.value) return
    try {
      localStorage.setItem(draftKey, JSON.stringify(serialize()))
      lastSavedAt.value = new Date()
    }
    catch {
      // Sin almacenamiento disponible: el editor sigue funcionando sin autosave.
    }
  }

  function readDraft(): DesignJson | null {
    try {
      const raw = localStorage.getItem(draftKey)
      return raw ? JSON.parse(raw) as DesignJson : null
    }
    catch {
      return null
    }
  }

  function discardDraft(): void {
    try {
      localStorage.removeItem(draftKey)
    }
    catch {
      // ignorar
    }
  }

  // ---------- exportación ----------

  async function exportSide(side: SideKey, multiplier?: number): Promise<Blob | null> {
    const rt = sides[side]
    if (!rt) return null
    rt.canvas.discardActiveObject()
    rt.canvas.renderAll()
    const el = rt.canvas.toCanvasElement(multiplier ?? 1 / rt.canvas.getZoom())
    return new Promise(resolve => el.toBlob(resolve, 'image/png'))
  }

  /** PNG final por lado (tamaño real del lienzo) + JSON persistible. */
  async function exportDesign(): Promise<DesignExport> {
    const images: DesignExport['images'] = {}
    for (const key of sideKeys) {
      const blob = await exportSide(key)
      if (blob) images[key] = blob
    }
    readSelection()
    return { design: serialize(), images }
  }

  /** true si algún lado obligatorio está vacío. */
  function missingRequiredSides(): SideKey[] {
    return template.zones
      .filter(z => z.required && (sides[z.key]?.canvas.getObjects().length ?? 0) === 0)
      .map(z => z.key)
  }

  if (getCurrentScope()) onScopeDispose(() => void dispose())

  return {
    template,
    sideKeys,
    activeSide,
    isReady,
    isBusy,
    hasChanges,
    lastSavedAt,
    selection,
    canUndo,
    canRedo,
    mount,
    resize,
    setSide,
    dispose,
    addText,
    addSticker,
    addImage,
    setBackground,
    updateText,
    applyFilter,
    removeSelected,
    duplicateSelected,
    bringForward,
    sendBackward,
    centerSelected,
    clearSide,
    undo,
    redo,
    serialize,
    restore,
    readDraft,
    discardDraft,
    exportSide,
    exportDesign,
    missingRequiredSides
  }
}

export type ProductEditor = ReturnType<typeof useProductEditor>
