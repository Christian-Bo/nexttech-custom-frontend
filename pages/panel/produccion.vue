<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { ApiError } from '~/types/api'
import type { ProductionDetail, ProductionOrderDto, ProductionZone } from '~/features/production/types/production'
import { useProductionService } from '~/features/production/services/productionService'
import { isApiError } from '~/services/api'
import { downloadBlob } from '~/services/credentialService'
import { formatQ, formatTime } from '~/utils/format'

/**
 * Cola de producción (SUPERVISOR / ADMIN).
 * Enunciado 3.n: la elaboración debe tomar como máximo 60 s desde que se genera la orden.
 */
definePageMeta({ middleware: 'staff' })
useHead({ title: 'Producción · NextTech Custom' })

const ELABORATION_LIMIT_S = 60

const service = useProductionService()
const realtime = useRealtime()
const snackbar = useSnackbar()

/* Detalle para impresión: imágenes finales de cada lado y descarga del archivo. */
const detail = ref<ProductionDetail | null>(null)
const detailOpen = ref(false)
const detailLoading = ref(false)
const downloadingFile = ref<number | null>(null)
const selected = ref<string[]>([])
const printing = ref(false)
const writingNfc = ref(false)
const nfcMessage = ref('')
const selectedNfcItemIndex = ref(0)
const { confirm } = useConfirm()

/** Web NFC solo existe en navegadores Android compatibles y en contexto seguro. */
interface NdefWriter { write: (message: { records: { recordType: string, data: string }[] }) => Promise<void> }
type NdefConstructor = new () => NdefWriter
const nfcSupported = ref(false)
const nfcItems = computed(() => (detail.value?.items ?? [])
  .map((item, i) => ({ title: `${i + 1}. ${item.nombreProducto}${item.nombreVariante ? ` · ${item.nombreVariante}` : ''}`, value: i, hasNfc: !!item.nfcUrl }))
  .filter(item => item.hasNfc))
const nfcSelectedItem = computed(() => detail.value?.items[selectedNfcItemIndex.value])
const nfcWriteUrl = computed(() => {
  if (!detail.value) return ''
  if (detail.value.items.length === 1) return nfcSelectedItem.value?.nfcWriteUrl ?? detail.value.nfcWriteUrl ?? ''
  return nfcSelectedItem.value?.nfcWriteUrl ?? ''
})
const nfcCustomerUrl = computed(() => nfcSelectedItem.value?.nfcUrl ?? detail.value?.nfcUrl ?? '')
const multipleNfcDestinations = computed(() => new Set(
  (detail.value?.items ?? []).map(item => item.nfcUrl?.trim()).filter(Boolean)
).size > 1)
const validNfcWriteUrl = computed(() => {
  if (multipleNfcDestinations.value) return false
  try { return !!nfcWriteUrl.value && new URL(nfcWriteUrl.value).protocol === 'https:' }
  catch { return false }
})

async function writeNfc(): Promise<void> {
  if (!validNfcWriteUrl.value || writingNfc.value) {
    if (!validNfcWriteUrl.value) nfcMessage.value = 'El backend no devolvió un nfcWriteUrl HTTPS válido. No se grabó ninguna etiqueta.'
    return
  }
  const constructor = (window as Window & { NDEFReader?: NdefConstructor }).NDEFReader
  if (!constructor || !window.isSecureContext) {
    nfcMessage.value = 'Este teléfono no puede grabar desde el navegador. Usa un Android con Chrome.'
    return
  }
  writingNfc.value = true
  const targetUrl = nfcWriteUrl.value
  nfcMessage.value = 'Esperando: Acerca la etiqueta a la parte de atrás del teléfono.'
  try {
    const writer = new constructor()
    // Nunca grabar nfcUrl del comprador: el chip almacena solo nfcWriteUrl.
    await writer.write({ records: [{ recordType: 'url', data: targetUrl }] })
    nfcMessage.value = 'Etiqueta lista. Al tocarla se abre el enlace del cliente.'
  }
  catch (e) {
    const name = e instanceof DOMException ? e.name : ''
    nfcMessage.value = name === 'NotFoundError' || name === 'TimeoutError'
      ? 'No se encontró la etiqueta. Acércala otra vez y mantenla quieta un segundo.'
      : name === 'NotAllowedError'
        ? 'Permite el acceso NFC en el navegador para grabar la etiqueta.'
        : 'No se pudo grabar la etiqueta. Revisa que NFC esté activado y vuelve a intentar.'
  }
  finally { writingNfc.value = false }
}

async function printPdf(kind: 'batch' | 'queue' | 'one', codigo?: string): Promise<void> {
  if (printing.value) return
  const codes = [...new Set(selected.value)].filter(c => inProduction.value.some(o => o.codigoOrden === c))
  if (kind === 'queue' && inProduction.value.length > 50) {
    snackbar.warning('La cola supera 50 pedidos. Selecciona un lote de hasta 50 códigos para imprimir.')
    return
  }
  if (kind === 'batch' && (!codes.length || codes.length > 50)) {
    snackbar.warning('Selecciona entre 1 y 50 pedidos por lote.')
    return
  }
  const ok = await confirm({
    title: 'Impresión de llaveros',
    message: 'Papel A4. Imprime al 100% / tamaño real. No uses «Ajustar a la página». La barra negra debe medir 4.06 cm.',
    confirmText: 'Generar PDF'
  })
  if (!ok) return
  printing.value = true
  try {
    const blob = kind === 'batch' ? await service.printSelected(codes)
      : kind === 'queue' ? await service.printQueue() : await service.reprint(codigo!)
    if (blob.size < 5 || await blob.slice(0, 5).text() !== '%PDF-') throw new Error('El servidor no devolvió un PDF válido.')
    downloadBlob(blob, kind === 'one' ? `impresion-${codigo}.pdf` : `impresion-lote-${kind === 'batch' ? codes.length : 'cola'}-llaveros.pdf`)
    snackbar.success('PDF listo. Recuerda imprimir a tamaño real (100%).')
  }
  catch (e) { snackbar.error(isApiError(e) ? e : e instanceof Error ? e.message : 'No se pudo imprimir el lote.') }
  finally { printing.value = false }
}

const allSelected = computed(() => inProduction.value.length > 0 && inProduction.value.every(o => selected.value.includes(o.codigoOrden)))
function toggleAll(value: boolean | null): void { selected.value = value ? inProduction.value.map(o => o.codigoOrden) : [] }

async function openDetail(codigo: string): Promise<void> {
  detailOpen.value = true
  detailLoading.value = true
  detail.value = null
  nfcMessage.value = ''
  selectedNfcItemIndex.value = 0
  try {
    detail.value = await service.getDetail(codigo)
    const index = detail.value.items.findIndex(item => !!item.nfcUrl)
    selectedNfcItemIndex.value = index >= 0 ? index : 0
  }
  catch (e) {
    detailOpen.value = false
    snackbar.error(isApiError(e) ? e : 'No se pudo cargar el diseño.')
  }
  finally {
    detailLoading.value = false
  }
}

function zoneSrc(z: ProductionZone): string {
  return `data:${z.tipoMime};base64,${z.imagenBase64}`
}

async function downloadZone(z: ProductionZone): Promise<void> {
  if (!detail.value) return
  downloadingFile.value = z.idArchivoImagenFinal
  try {
    const blob = await service.downloadFile(detail.value.codigoOrden, z.idArchivoImagenFinal)
    const ext = z.tipoMime.split('/')[1] ?? 'png'
    downloadBlob(blob, `${detail.value.codigoOrden}-${z.nombre.replace(/\s+/g, '-')}.${ext}`)
  }
  catch (e) {
    snackbar.error(isApiError(e) ? e : 'No se pudo descargar el archivo.')
  }
  finally {
    downloadingFile.value = null
  }
}

const inProduction = ref<ProductionOrderDto[]>([])
const ready = ref<ProductionOrderDto[]>([])
const loading = ref(true)
const error = ref<ApiError | null>(null)
const marking = ref<Set<string>>(new Set())
const detailOrder = computed(() => inProduction.value.find(o => o.codigoOrden === detail.value?.codigoOrden))
const now = ref(Date.now())
let clock: ReturnType<typeof setInterval> | null = null
let productionRefresh: ReturnType<typeof setInterval> | null = null

const overdue = computed(() => inProduction.value.filter(o => elapsed(o) > ELABORATION_LIMIT_S).length)

function elapsed(o: ProductionOrderDto): number {
  return Math.max(0, Math.round((now.value - Date.parse(o.fechaCreacion)) / 1000))
}

function elapsedLabel(o: ProductionOrderDto): string {
  const s = elapsed(o)
  if (s < 60) return `${s} s`
  const m = Math.floor(s / 60)
  return m < 60 ? `${m} min ${s % 60} s` : `${Math.floor(m / 60)} h ${m % 60} min`
}

async function load(silent = false): Promise<void> {
  if (!silent) loading.value = true
  error.value = null
  try {
    const [a, b] = await Promise.all([service.listInProduction(), service.listReady()])
    inProduction.value = a
    selected.value = selected.value.filter(code => a.some(o => o.codigoOrden === code))
    ready.value = b
  }
  catch (e) {
    if (!silent) error.value = isApiError(e) ? e : { status: 0, code: 'UNKNOWN', message: 'No se pudo cargar la producción.' }
  }
  finally {
    loading.value = false
  }
}

function markDetailReady(): void {
  if (detailOrder.value) void markReady(detailOrder.value)
}

async function markReady(o: ProductionOrderDto): Promise<void> {
  marking.value = new Set([...marking.value, o.codigoOrden])
  try {
    await service.markReady(o.codigoOrden)
    snackbar.success(`#${o.codigoOrden} listo para entrega (${elapsedLabel(o)})`)
    if (detail.value?.codigoOrden === o.codigoOrden) detailOpen.value = false
    await load(true)
  }
  catch (e) {
    snackbar.error(isApiError(e) ? e : 'No se pudo marcar como listo.')
  }
  finally {
    const s = new Set(marking.value)
    s.delete(o.codigoOrden)
    marking.value = s
  }
}

realtime.on('OrderStatusChanged', () => void load(true))
realtime.on('OrderCreated', () => void load(true))
// En taller seguimos consultando cada 5 s: /hubs/tracking es exclusivo de comprador.

onMounted(() => {
  nfcSupported.value = typeof window !== 'undefined' && window.isSecureContext && !!(window as Window & { NDEFReader?: NdefConstructor }).NDEFReader
  void load()
  clock = setInterval(() => (now.value = Date.now()), 1000)
  productionRefresh = setInterval(() => { if (document.visibilityState === 'visible') void load(true) }, 5000)
})
onBeforeUnmount(() => {
  if (clock) clearInterval(clock)
  if (productionRefresh) clearInterval(productionRefresh)
})
</script>

<template>
  <v-container
    fluid
    class="py-6 px-4 px-md-8"
    style="max-width: 1400px"
  >
    <div class="d-flex flex-wrap align-center ga-3 mb-6">
      <v-btn
        to="/panel"
        variant="text"
        icon="mdi-arrow-left"
        aria-label="Volver al dashboard"
      />
      <div>
        <h1 class="text-h5 font-weight-bold">
          Producción
        </h1>
        <div class="text-caption text-medium-emphasis">
          Meta: cada pedido listo en menos de {{ ELABORATION_LIMIT_S }} s
        </div>
      </div>
      <RealtimeIndicator />
      <v-spacer />
      <v-chip
        v-if="overdue > 0"
        color="warning"
        variant="tonal"
        prepend-icon="mdi-timer-alert-outline"
      >
        {{ overdue }} fuera de tiempo
      </v-chip>
    </div>

    <v-skeleton-loader
      v-if="loading"
      type="card@2"
    />

    <StateError
      v-else-if="error"
      :error="error"
      @retry="load()"
    />

    <div
      v-else
      class="columns"
    >
      <!-- En elaboración -->
      <section>
        <h2 class="col-title">
          <v-icon
            icon="mdi-hammer-wrench"
            color="warning"
          /> En elaboración
          <span class="count">{{ inProduction.length }}</span>
        </h2>
        <v-card border variant="tonal" class="pa-3 mb-3" rounded="lg">
          <div class="d-flex align-center flex-wrap ga-2 mb-2">
            <v-checkbox-btn :model-value="allSelected" label="Seleccionar todos" :disabled="!inProduction.length" @update:model-value="toggleAll" />
            <v-spacer />
            <v-chip size="small">{{ selected.length }} seleccionados</v-chip>
          </div>
          <div class="d-flex flex-wrap ga-2">
            <v-btn color="primary" prepend-icon="mdi-printer" :disabled="!selected.length || selected.length > 50" :loading="printing" @click="printPdf('batch')">Imprimir seleccionados</v-btn>
            <v-btn variant="tonal" prepend-icon="mdi-printer-outline" :disabled="!inProduction.length || inProduction.length > 50" :loading="printing" @click="printPdf('queue')">Imprimir toda la cola</v-btn>
          </div>
          <p class="text-caption text-medium-emphasis mt-2 mb-0">Máximo 50 llaveros por lote. Papel A4, escala 100%, sin ajustar a página.</p>
        </v-card>
        <v-alert v-if="inProduction.length > 50" type="warning" variant="tonal" density="compact" class="mb-3">La cola contiene más de 50 pedidos. Imprime lotes seleccionados de máximo 50.</v-alert>
        <StateEmpty
          v-if="inProduction.length === 0"
          icon="mdi-check-all"
          title="Nada en producción"
          description="Los pedidos nuevos aparecerán aquí automáticamente."
        />
        <TransitionGroup
          v-else
          name="card"
          tag="div"
          class="d-flex flex-column ga-3"
        >
          <v-card
            v-for="o in inProduction"
            :key="o.codigoOrden"
            border
            variant="flat"
            class="pa-4"
            :class="{ 'card--late': elapsed(o) > ELABORATION_LIMIT_S }"
          >
            <div class="d-flex align-center ga-2 mb-1">
              <v-checkbox-btn v-model="selected" :value="o.codigoOrden" :aria-label="`Seleccionar ${o.codigoOrden}`" />
              <strong>#{{ o.codigoOrden }}</strong>
              <v-spacer />
              <v-chip
                size="small"
                variant="tonal"
                :color="elapsed(o) > ELABORATION_LIMIT_S ? 'warning' : 'info'"
                prepend-icon="mdi-timer-outline"
              >
                {{ elapsedLabel(o) }}
              </v-chip>
            </div>
            <div class="text-body-2 text-medium-emphasis mb-3">
              {{ (o.nicknameComprador || 'Comprador sin nombre disponible') + ' · ' }}{{ o.areaEntrega }} · {{ formatQ(o.total) }} · desde {{ formatTime(o.fechaCreacion) }}
            </div>
            <div class="d-flex flex-wrap ga-2">
              <v-btn
                variant="tonal"
                prepend-icon="mdi-printer-outline"
                class="text-none"
                @click="openDetail(o.codigoOrden)"
              >
                Diseño
              </v-btn>
              <v-btn variant="text" class="text-none" size="small" prepend-icon="mdi-printer" :loading="printing" @click="printPdf('one', o.codigoOrden)">Reimprimir</v-btn>
              <v-btn
                color="primary"
                class="flex-1-1"
                prepend-icon="mdi-package-variant-closed-check"
                :loading="marking.has(o.codigoOrden)"
                @click="markReady(o)"
              >
                Marcar listo para entrega
              </v-btn>
            </div>
          </v-card>
        </TransitionGroup>
      </section>

      <!-- Listos -->
      <section>
        <h2 class="col-title">
          <v-icon
            icon="mdi-package-variant-closed-check"
            color="accent"
          /> Listos para entrega
          <span class="count">{{ ready.length }}</span>
        </h2>
        <StateEmpty
          v-if="ready.length === 0"
          icon="mdi-package-variant-closed"
          title="Sin pedidos esperando repartidor"
        />
        <TransitionGroup
          v-else
          name="card"
          tag="div"
          class="d-flex flex-column ga-2"
        >
          <div
            v-for="o in ready"
            :key="o.codigoOrden"
            class="ready-row"
          >
            <strong>#{{ o.codigoOrden }}</strong>
            <span class="text-medium-emphasis">{{ o.areaEntrega }}</span>
            <v-spacer />
            <span>{{ formatQ(o.total) }}</span>
          </div>
        </TransitionGroup>
      </section>
    </div>
    <!-- Diseño para impresión -->
    <v-dialog
      v-model="detailOpen"
      max-width="760"
      scrollable
    >
      <v-card
        rounded="lg"
        border
      >
        <v-card-title class="d-flex align-center pt-5 px-6">
          <v-icon
            icon="mdi-printer-outline"
            class="mr-2"
          />
          Diseño para imprimir
          <v-spacer />
          <v-btn
            icon="mdi-close"
            variant="text"
            size="small"
            aria-label="Cerrar"
            @click="detailOpen = false"
          />
        </v-card-title>
        <v-card-text class="px-6 pb-6">
          <v-skeleton-loader
            v-if="detailLoading"
            type="article, image"
          />
          <template v-else-if="detail">
            <div class="d-flex flex-wrap ga-2 mb-4">
              <v-chip
                size="small"
                variant="tonal"
                prepend-icon="mdi-pound"
              >
                {{ detail.codigoOrden }}
              </v-chip>
              <v-chip
                size="small"
                variant="tonal"
                prepend-icon="mdi-account-outline"
              >
                {{ detail.nicknameComprador }}
              </v-chip>
              <v-chip
                size="small"
                variant="tonal"
                prepend-icon="mdi-map-marker-outline"
              >
                {{ detail.areaEntrega }}
              </v-chip>
            </div>
            <v-card variant="tonal" class="pa-4 mb-4" rounded="lg">
              <div class="font-weight-bold mb-2">NFC · Grabar el chip</div>
              <v-select v-if="nfcItems.length > 1" v-model="selectedNfcItemIndex" :items="nfcItems" label="Llavero del pedido" density="comfortable" variant="outlined" class="mt-2" @update:model-value="nfcMessage = ''" />
              <div class="text-body-2 mb-2">Enlace del cliente (solo lectura):</div>
              <div class="text-body-2" style="overflow-wrap:anywhere">{{ nfcCustomerUrl || 'El detalle no incluye nfcUrl.' }}</div>
              <v-alert v-if="multipleNfcDestinations" type="error" variant="tonal" density="compact" class="mt-3">Este pedido contiene distintos destinos NFC, pero el backend genera un único /n/ORD para toda la orden. No grabes esos chips hasta que el backend pueda distinguir los destinos por artículo.</v-alert>
              <v-alert v-else-if="!validNfcWriteUrl" type="warning" variant="tonal" density="compact" class="mt-3">El detalle no incluye un nfcWriteUrl HTTPS válido. Solicita al backend que lo devuelva; nunca escribimos nfcUrl en el chip.</v-alert>
              <v-btn block color="primary" prepend-icon="mdi-nfc" class="mt-3" :disabled="!nfcSupported || !validNfcWriteUrl" :loading="writingNfc" @click="writeNfc">Grabar NFC</v-btn>
              <div class="text-caption mt-2">Acerca la etiqueta a la parte de atrás del teléfono y mantenla quieta un segundo.</div>
              <div class="text-caption text-medium-emphasis">Usa Android con Chrome o Edge. iPhone no puede grabar desde el navegador.</div>
              <v-alert v-if="!nfcSupported" type="info" density="compact" variant="tonal" class="mt-2">Este teléfono no puede grabar desde el navegador. Usa un Android con Chrome.</v-alert>
              <v-alert v-if="nfcMessage" type="info" density="compact" variant="tonal" class="mt-2">{{ nfcMessage }}</v-alert>
              <div v-if="nfcItems.length > 1" class="text-caption text-medium-emphasis mt-2">El backend genera el mismo enlace corto /n/ORD para todos los artículos de esta orden. Si contienen destinos distintos, consulta con backend antes de grabar múltiples chips.</div>
              <v-btn variant="tonal" prepend-icon="mdi-printer" class="mt-3" :loading="printing" @click="printPdf('one', detail.codigoOrden)">Imprimir este llavero</v-btn>
              <v-btn v-if="detailOrder" color="success" prepend-icon="mdi-check-circle-outline" class="mt-3 ml-sm-2" :loading="marking.has(detail.codigoOrden)" @click="markDetailReady">Marcar listo para entrega</v-btn>
            </v-card>
            <section
              v-for="(item, i) in detail.items"
              :key="i"
              class="print-item"
            >
              <div class="font-weight-bold mb-2">
                {{ item.cantidad }} × {{ item.nombreProducto }}
                <span
                  v-if="item.nombreVariante"
                  class="text-medium-emphasis"
                >· {{ item.nombreVariante }}</span>
              </div>
              <div
                v-if="item.zonas.length"
                class="zones"
              >
                <figure
                  v-for="z in item.zonas"
                  :key="z.idArchivoImagenFinal"
                  class="zone"
                >
                  <img
                    :src="zoneSrc(z)"
                    :alt="`${item.nombreProducto} - ${z.nombre}`"
                  >
                  <figcaption>
                    <span>{{ z.nombre }}</span>
                    <v-btn
                      size="small"
                      variant="tonal"
                      class="text-none"
                      prepend-icon="mdi-download"
                      :loading="downloadingFile === z.idArchivoImagenFinal"
                      @click="downloadZone(z)"
                    >
                      Descargar
                    </v-btn>
                  </figcaption>
                </figure>
              </div>
              <p
                v-else
                class="text-body-2 text-medium-emphasis"
              >
                Sin archivos de impresión para este artículo.
              </p>
            </section>
          </template>
        </v-card-text>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<style scoped>
.print-item + .print-item {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid rgb(148 163 184 / 25%);
}

.zones {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 14px;
}

.zone {
  margin: 0;
  padding: 10px;
  border-radius: 12px;
  border: 1px solid rgb(148 163 184 / 25%);
  background: rgb(15 23 42 / 60%);
}

.zone img {
  display: block;
  width: 100%;
  aspect-ratio: 1;
  object-fit: contain;
  border-radius: 8px;
  background: repeating-conic-gradient(#1e293b 0% 25%, #273449 0% 50%) 50% / 16px 16px;
}

.zone figcaption {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
  font-weight: 600;
}

.columns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24px;
  align-items: start;
}

.col-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.05rem;
  font-weight: 700;
  margin-bottom: 12px;
}

.count {
  margin-left: 4px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 0.8rem;
  background: var(--nt-surface-elevated);
}

.card--late {
  border-color: var(--nt-warning) !important;
}

.ready-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  background: var(--nt-surface);
  border: 1px solid var(--nt-border);
  border-radius: var(--nt-radius-md);
}

.card-enter-active,
.card-leave-active {
  transition: all 350ms ease;
}

.card-enter-from,
.card-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

@media (max-width: 800px) {
  .columns {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
