<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { ApiError } from '~/types/api'
import type { DeliveryOrderDto, DeliveryResult } from '../types/delivery'
import { AREA_ICONS, formatQ, useDeliveryService } from '../services/deliveryService'
import { isApiError } from '~/services/api'
import { fileService } from '~/services/fileService'
import { processImage } from '~/utils/image'
import type { QrValidationResult } from '~/composables/useQrScanner'
import { useDisplay } from 'vuetify'

const props = defineProps<{ codigoOrden: string }>()

const service = useDeliveryService()
const { xs } = useDisplay()
const snackbar = useSnackbar()
const { confirm } = useConfirm()

const order = ref<DeliveryOrderDto | null>(null)
const loading = ref(true)
const error = ref<ApiError | null>(null)
const acting = ref(false)

// Pasos de la entrega
const qrDialog = ref(false)
const cameraDialog = ref(false)
const cashReceived = ref<number | null>(null)
const photo = ref<Blob | null>(null)
const photoUrl = ref<string | null>(null)
const evidenceUrl = ref<string | null>(null)

// Reporte de problema
const failDialog = ref(false)
const failReason = ref<Exclude<DeliveryResult, 'ENTREGADO'>>('COMPRADOR_NO_ENCONTRADO')
const failNote = ref('')

const isCash = computed(() => order.value?.pago.metodo === 'EFECTIVO' && order.value.pago.estado !== 'PAGADO')
const change = computed(() => (order.value && cashReceived.value ? cashReceived.value - order.value.total : 0))
const cashOk = computed(() => !isCash.value || (cashReceived.value ?? 0) >= (order.value?.total ?? Infinity))
const qrOk = computed(() => !!order.value?.qrUtilizado)
const canConfirm = computed(() => qrOk.value && cashOk.value && !!photo.value)
const isFinal = computed(() => order.value && !['LISTO_PARA_ENTREGA', 'EN_ENTREGA'].includes(order.value.estado))
const whatsapp = computed(() => order.value?.telefonoComprador?.replace(/\D/g, '') ?? '')

/** Billetes sugeridos para cobrar rápido. */
const quickCash = computed(() => {
  const total = order.value?.total ?? 0
  const options = new Set<number>([total])
  for (const bill of [50, 100, 200]) {
    const v = Math.ceil(total / bill) * bill
    if (v > total) options.add(v)
  }
  return [...options].slice(0, 4)
})

function toApiError(e: unknown, fallback: string): ApiError {
  return isApiError(e) ? e : { status: 0, code: 'UNKNOWN', message: fallback }
}

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    order.value = await service.getOrder(props.codigoOrden)
    await loadEvidence()
  }
  catch (e) {
    error.value = toApiError(e, 'No se pudo cargar el pedido.')
  }
  finally {
    loading.value = false
  }
}

async function loadEvidence(): Promise<void> {
  const id = order.value?.ultimoIntento?.fotoFileId
  if (!id) return
  const blob = await fileService.get(id)
  if (blob) evidenceUrl.value = URL.createObjectURL(blob)
}

async function startDelivery(): Promise<void> {
  const ok = await confirm({
    title: '¿Iniciar la entrega?',
    message: `Se notificará a ${order.value?.nicknameComprador} que su pedido va en camino.`,
    confirmText: 'Iniciar'
  })
  if (!ok) return
  acting.value = true
  try {
    order.value = await service.startDelivery(props.codigoOrden)
    snackbar.info('Entrega iniciada. ¡Buen viaje!')
  }
  catch (e) {
    snackbar.error(toApiError(e, 'No se pudo iniciar la entrega.'))
  }
  finally {
    acting.value = false
  }
}

async function validateQr(code: string): Promise<QrValidationResult> {
  const result = await service.validateOrderQr(props.codigoOrden, code)
  if (result.ok) {
    order.value = await service.getOrder(props.codigoOrden)
    setTimeout(() => (qrDialog.value = false), 900)
  }
  return result
}

function setPhoto(blob: Blob): void {
  if (photoUrl.value) URL.revokeObjectURL(photoUrl.value)
  photo.value = blob
  photoUrl.value = URL.createObjectURL(blob)
  cameraDialog.value = false
}

function onGalleryPhoto(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) setPhoto(file)
}

/** Optimiza la foto (máx. 1280 px, <2 MB) antes de enviarla. */
async function processedPhoto(): Promise<Blob | undefined> {
  if (!photo.value) return undefined
  return processImage(photo.value, { maxSide: 1280, quality: 0.8 })
}

async function confirmDelivery(): Promise<void> {
  if (!order.value || !canConfirm.value) return
  const ok = await confirm({
    title: 'Confirmar entrega',
    message: isCash.value
      ? `Cobraste ${formatQ(cashReceived.value ?? 0)}. Vuelto: ${formatQ(change.value)}.`
      : 'El pedido quedará marcado como entregado.',
    confirmText: 'Confirmar entrega'
  })
  if (!ok) return
  acting.value = true
  try {
    const foto = await processedPhoto()
    order.value = await service.complete(props.codigoOrden, {
      foto: foto!,
      montoRecibido: isCash.value ? cashReceived.value ?? undefined : undefined
    })
    await loadEvidence()
    snackbar.success('¡Entrega confirmada!')
  }
  catch (e) {
    snackbar.error(toApiError(e, 'No se pudo confirmar la entrega.'))
  }
  finally {
    acting.value = false
  }
}

async function submitFailure(): Promise<void> {
  if (failNote.value.trim().length < 5) return
  acting.value = true
  try {
    order.value = await service.reportFailed(props.codigoOrden, {
      resultado: failReason.value,
      observacion: failNote.value.trim(),
      foto: await processedPhoto()
    })
    failDialog.value = false
    await loadEvidence()
    snackbar.info('Reporte registrado.')
  }
  catch (e) {
    snackbar.error(toApiError(e, 'No se pudo registrar el reporte.'))
  }
  finally {
    acting.value = false
  }
}

onMounted(load)
onBeforeUnmount(() => {
  if (photoUrl.value) URL.revokeObjectURL(photoUrl.value)
  if (evidenceUrl.value) URL.revokeObjectURL(evidenceUrl.value)
})
</script>

<template>
  <div>
    <v-btn
      to="/repartidor"
      variant="text"
      prepend-icon="mdi-arrow-left"
      class="mb-2 px-0"
    >
      Pedidos
    </v-btn>

    <v-skeleton-loader
      v-if="loading"
      type="article, list-item-three-line, actions"
    />

    <StateError
      v-else-if="error || !order"
      :error="error"
      @retry="load"
    />

    <div
      v-else
      class="d-flex flex-column ga-3"
    >
      <!-- Encabezado -->
      <div class="d-flex align-center ga-2">
        <h1 class="text-h6 font-weight-bold">
          #{{ order.codigoOrden }}
        </h1>
        <StatusChip :status="order.estado" />
        <v-spacer />
        <span class="text-h6 font-weight-bold">{{ formatQ(order.total) }}</span>
      </div>

      <!-- Comprador y punto de entrega -->
      <v-card
        border
        variant="flat"
        class="pa-4"
      >
        <div class="d-flex align-center ga-3 mb-3">
          <v-avatar
            color="primary"
            variant="tonal"
          >
            <v-icon icon="mdi-account" />
          </v-avatar>
          <div class="flex-grow-1">
            <div class="font-weight-medium">
              {{ order.nicknameComprador }}
            </div>
            <div class="text-caption text-medium-emphasis">
              Comprador
            </div>
          </div>
          <template v-if="order.telefonoComprador">
            <v-btn
              icon="mdi-phone"
              variant="tonal"
              size="small"
              :href="`tel:${order.telefonoComprador}`"
              aria-label="Llamar"
            />
            <v-btn
              icon="mdi-whatsapp"
              variant="tonal"
              size="small"
              color="success"
              :href="`https://wa.me/${whatsapp}`"
              target="_blank"
              rel="noopener"
              aria-label="WhatsApp"
            />
          </template>
        </div>
        <v-divider class="mb-3" />
        <div class="d-flex ga-3">
          <v-icon
            :icon="AREA_ICONS[order.areaEntrega] ?? 'mdi-map-marker-outline'"
            color="accent"
          />
          <div>
            <div class="font-weight-medium">
              {{ order.areaEntrega }}
            </div>
            <div class="text-body-2 text-medium-emphasis">
              {{ order.referenciaEntrega }}
            </div>
          </div>
        </div>
      </v-card>

      <!-- Productos -->
      <v-card
        v-if="order.items.length > 0"
        border
        variant="flat"
        class="pa-4"
      >
        <div class="text-overline mb-1">
          Productos
        </div>
        <div
          v-for="item in order.items"
          :key="item.idDetalleOrden"
          class="d-flex align-center ga-3 py-2"
        >
          <v-avatar
            rounded="lg"
            color="surface-light"
          >
            <span class="font-weight-bold">{{ item.cantidad }}×</span>
          </v-avatar>
          <div class="flex-grow-1">
            <div class="text-body-2 font-weight-medium">
              {{ item.nombreProducto }}
            </div>
            <div class="text-caption text-medium-emphasis">
              {{ item.nombreVariante }}
              <v-chip
                v-if="item.personalizado"
                size="x-small"
                variant="tonal"
                color="accent"
                class="ml-1"
              >
                personalizado
              </v-chip>
            </div>
          </div>
          <span class="text-body-2">{{ formatQ(item.subtotal) }}</span>
        </div>
        <v-divider class="my-2" />
        <div class="d-flex align-center">
          <v-icon
            :icon="order.pago.metodo === 'EFECTIVO' ? 'mdi-cash' : 'mdi-credit-card-outline'"
            class="mr-2"
          />
          <span class="text-body-2">{{ order.pago.metodo === 'EFECTIVO' ? 'Efectivo' : 'Tarjeta' }}</span>
          <v-chip
            size="x-small"
            class="ml-2"
            variant="tonal"
            :color="order.pago.estado === 'PAGADO' ? 'success' : order.pago.estado === 'RECHAZADO' ? 'error' : 'warning'"
          >
            {{ order.pago.estado === 'PAGADO' ? 'Pagado' : order.pago.estado === 'RECHAZADO' ? 'Rechazado' : 'Por cobrar' }}
          </v-chip>
          <v-spacer />
          <strong>{{ formatQ(order.total) }}</strong>
        </div>
      </v-card>

      <v-card
        v-if="order.items.length === 0"
        border
        variant="flat"
        class="pa-4 d-flex align-center"
      >
        <v-icon
          :icon="order.pago.metodo === 'EFECTIVO' ? 'mdi-cash' : 'mdi-credit-card-outline'"
          class="mr-2"
        />
        <span class="text-body-2">{{ order.pago.metodo === 'EFECTIVO' ? 'Efectivo' : 'Tarjeta' }}</span>
        <v-chip
          size="x-small"
          class="ml-2"
          variant="tonal"
          :color="order.pago.estado === 'PAGADO' ? 'success' : 'warning'"
        >
          {{ order.pago.estado === 'PAGADO' ? 'Pagado' : 'Por cobrar' }}
        </v-chip>
        <v-spacer />
        <strong>{{ formatQ(order.total) }}</strong>
      </v-card>

      <!-- Acción: iniciar -->
      <v-btn
        v-if="order.estado === 'LISTO_PARA_ENTREGA'"
        color="primary"
        size="x-large"
        block
        prepend-icon="mdi-truck-fast-outline"
        :loading="acting"
        @click="startDelivery"
      >
        Iniciar entrega
      </v-btn>

      <!-- Flujo de entrega -->
      <template v-else-if="order.estado === 'EN_ENTREGA'">
        <div class="text-overline">
          Confirmar entrega
        </div>

        <!-- Paso 1: QR -->
        <div
          class="step"
          :class="{ 'step--done': qrOk }"
        >
          <v-icon
            :icon="qrOk ? 'mdi-check-circle' : 'mdi-numeric-1-circle-outline'"
            :color="qrOk ? 'success' : undefined"
            size="28"
          />
          <div class="flex-grow-1">
            <div class="font-weight-medium">
              Verificar QR del comprador
            </div>
            <div class="text-caption text-medium-emphasis">
              {{ qrOk ? 'Comprador verificado' : 'Pídele que muestre el QR de su pedido' }}
            </div>
          </div>
          <v-btn
            v-if="!qrOk"
            color="primary"
            variant="tonal"
            prepend-icon="mdi-qrcode-scan"
            @click="qrDialog = true"
          >
            Escanear
          </v-btn>
        </div>

        <!-- Paso 2: cobro -->
        <div
          v-if="order.pago.metodo === 'EFECTIVO'"
          class="step step--column"
          :class="{ 'step--done': cashOk }"
        >
          <div class="d-flex align-center ga-3">
            <v-icon
              :icon="cashOk ? 'mdi-check-circle' : 'mdi-numeric-2-circle-outline'"
              :color="cashOk ? 'success' : undefined"
              size="28"
            />
            <div class="flex-grow-1">
              <div class="font-weight-medium">
                Cobrar {{ formatQ(order.total) }} en efectivo
              </div>
              <div
                v-if="cashReceived && change >= 0"
                class="text-caption text-success"
              >
                Vuelto: {{ formatQ(change) }}
              </div>
              <div
                v-else-if="cashReceived && change < 0"
                class="text-caption text-error"
              >
                Faltan {{ formatQ(-change) }}
              </div>
            </div>
          </div>
          <div class="d-flex flex-wrap ga-2 mt-3">
            <v-chip
              v-for="v in quickCash"
              :key="v"
              :color="cashReceived === v ? 'primary' : undefined"
              :variant="cashReceived === v ? 'flat' : 'tonal'"
              @click="cashReceived = v"
            >
              {{ formatQ(v) }}
            </v-chip>
          </div>
          <v-number-input
            v-model="cashReceived"
            label="Monto recibido"
            prefix="Q"
            :min="0"
            :precision="2"
            control-variant="hidden"
            density="compact"
            hide-details
            class="mt-3"
          />
        </div>

        <!-- Paso 3: foto -->
        <div
          class="step"
          :class="{ 'step--done': !!photo }"
        >
          <v-icon
            :icon="photo ? 'mdi-check-circle' : `mdi-numeric-${order.pago.metodo === 'EFECTIVO' ? 3 : 2}-circle-outline`"
            :color="photo ? 'success' : undefined"
            size="28"
          />
          <div class="flex-grow-1">
            <div class="font-weight-medium">
              Foto de evidencia
            </div>
            <div class="text-caption text-medium-emphasis">
              El producto entregado o el punto de entrega
            </div>
          </div>
          <img
            v-if="photoUrl"
            :src="photoUrl"
            alt="Foto de evidencia"
            class="step__thumb"
          >
          <v-btn
            color="primary"
            variant="tonal"
            :icon="photo ? 'mdi-camera-retake-outline' : 'mdi-camera'"
            :aria-label="photo ? 'Repetir foto' : 'Tomar foto'"
            @click="cameraDialog = true"
          />
        </div>

        <v-btn
          color="success"
          size="x-large"
          block
          prepend-icon="mdi-check-decagram"
          :disabled="!canConfirm"
          :loading="acting"
          class="mt-2"
          @click="confirmDelivery"
        >
          Confirmar entrega
        </v-btn>
        <v-btn
          variant="text"
          color="error"
          block
          prepend-icon="mdi-alert-circle-outline"
          @click="failDialog = true"
        >
          No pude entregar
        </v-btn>
      </template>

      <!-- Resultado final -->
      <v-card
        v-if="isFinal && order.ultimoIntento"
        border
        variant="flat"
        class="pa-4"
      >
        <div class="d-flex align-center ga-2 mb-2">
          <v-icon
            :icon="order.ultimoIntento.resultado === 'ENTREGADO' ? 'mdi-check-decagram' : 'mdi-account-alert-outline'"
            :color="order.ultimoIntento.resultado === 'ENTREGADO' ? 'success' : 'error'"
          />
          <strong>{{ order.ultimoIntento.resultado === 'ENTREGADO' ? 'Entregado' : 'No entregado' }}</strong>
          <v-spacer />
          <span class="text-caption text-medium-emphasis">
            {{ new Date(order.ultimoIntento.fechaHoraFin).toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'short' }) }}
          </span>
        </div>
        <p
          v-if="order.ultimoIntento.observacion"
          class="text-body-2 mb-2"
        >
          {{ order.ultimoIntento.observacion }}
        </p>
        <img
          v-if="evidenceUrl"
          :src="evidenceUrl"
          alt="Evidencia de entrega"
          class="evidence"
        >
      </v-card>
    </div>

    <!-- Diálogo: escanear QR -->
    <v-dialog
      v-model="qrDialog"
      max-width="460"
      :fullscreen="xs"
    >
      <v-card class="pa-4">
        <QrScanner
          v-if="qrDialog"
          title="QR del comprador"
          :validate="validateQr"
        />
        <v-btn
          variant="text"
          block
          class="mt-2"
          @click="qrDialog = false"
        >
          Cerrar
        </v-btn>
      </v-card>
    </v-dialog>

    <!-- Diálogo: foto -->
    <v-dialog
      v-model="cameraDialog"
      max-width="460"
    >
      <v-card class="pa-4">
        <CameraCapture
          v-if="cameraDialog"
          facing="environment"
          confirm-text="Usar foto"
          @capture="setPhoto"
          @cancel="cameraDialog = false"
        />
        <label class="gallery">
          <v-icon
            icon="mdi-image-outline"
            size="18"
          />
          Elegir de la galería
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            @change="onGalleryPhoto"
          >
        </label>
      </v-card>
    </v-dialog>

    <!-- Diálogo: no pude entregar -->
    <v-dialog
      v-model="failDialog"
      max-width="460"
    >
      <v-card
        rounded="lg"
        class="pa-2"
      >
        <v-card-title>No pude entregar</v-card-title>
        <v-card-text class="d-flex flex-column ga-3">
          <v-radio-group
            v-model="failReason"
            hide-details
          >
            <v-radio
              value="COMPRADOR_NO_ENCONTRADO"
              label="El comprador no estaba en el punto de entrega"
            />
            <v-radio
              v-if="order?.pago.metodo === 'EFECTIVO' && service.capabilities.paymentFailure"
              value="PAGO_NO_REALIZADO"
              label="El comprador no pudo pagar"
            />
          </v-radio-group>
          <v-textarea
            v-model="failNote"
            label="¿Qué pasó?"
            placeholder="Ej.: Esperé 10 minutos y no contestó el teléfono."
            rows="3"
            auto-grow
            counter="500"
            maxlength="500"
          />
          <div class="d-flex align-center ga-2">
            <v-btn
              variant="tonal"
              prepend-icon="mdi-camera"
              @click="cameraDialog = true"
            >
              {{ photo ? 'Cambiar foto' : 'Tomar foto' }}
            </v-btn>
            <span class="text-caption text-medium-emphasis">
              Opcional
            </span>
            <v-spacer />
            <img
              v-if="photoUrl"
              :src="photoUrl"
              alt="Foto"
              class="step__thumb"
            >
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            @click="failDialog = false"
          >
            Cancelar
          </v-btn>
          <v-btn
            color="error"
            variant="flat"
            :loading="acting"
            :disabled="failNote.trim().length < 5"
            @click="submitFailure"
          >
            Registrar
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
.step {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  background: var(--nt-surface);
  border: 1px solid var(--nt-border);
  border-radius: var(--nt-radius-md);
  transition: border-color var(--nt-transition-base);
}

.step--column {
  flex-direction: column;
  align-items: stretch;
}

.step--done {
  border-color: rgb(34 197 94 / 55%);
}

.step__thumb {
  width: 48px;
  height: 48px;
  object-fit: cover;
  border-radius: var(--nt-radius-sm);
}

.evidence {
  width: 100%;
  max-height: 320px;
  object-fit: cover;
  border-radius: var(--nt-radius-md);
}

.gallery {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 12px;
  font-size: 0.875rem;
  color: var(--nt-text-secondary);
  cursor: pointer;
}
</style>
