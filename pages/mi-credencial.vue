<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { downloadBlob, useCredentialService, type CredentialContext } from '~/services/credentialService'
import { useAuthService } from '~/services/authService'
import { useProfileService } from '~/features/profile/services/profileService'
import { isApiError } from '~/services/api'
import { useCredentialVisualDesign } from '~/composables/useCredentialVisualDesign'
import { useAuthStore } from '~/stores/auth'
import VisualCredentialEditor from '~/components/credential/VisualCredentialEditor.vue'
import { buildVisualCredentialPdf } from '~/utils/visualCredentialPdf'

definePageMeta({ middleware: 'buyer' })
useHead({ title: 'Mi credencial digital · NextTech Custom' })

const service = useCredentialService()
const authService = useAuthService()
const profile = useProfileService()
const auth = useAuthStore()
const snackbar = useSnackbar()
const { confirm } = useConfirm()
const loading = ref(true)
const missingEnrollment = ref(false)
const contextRateLimited = ref(false)
const message = ref('')
const context = ref<CredentialContext | null>(null)
const portraitUrl = ref('')
// El código QR es un secreto de autenticación. No guardarlo en cookies,
// localStorage, sessionStorage, Pinia persistido, archivos de log ni telemetría.
const activeQrCredential = ref('')
const activeQrImage = ref('')
const qrBusy = ref<'issue' | 'pdf' | 'send' | null>(null)
const deliveryStatus = ref<'idle' | 'sent' | 'error'>('idle')
const fallbackStickers = [
  { id: 'STAR', name: 'Star' }, { id: 'TECH', name: 'Tech' },
  { id: 'GAMER', name: 'Gamer' }, { id: 'CODE', name: 'Code' }
]
const { design: visualDesign, loaded: visualLoaded, storageAvailable, setDesign: setVisualDesign, resetDesign: resetVisualDesign } = useCredentialVisualDesign()

function clearObjectUrl(value: string): void { if (value) URL.revokeObjectURL(value) }

async function load(): Promise<void> {
  loading.value = true
  contextRateLimited.value = false
  message.value = ''
  try {
    context.value = await service.customizationContext()
    missingEnrollment.value = false
  }
  catch (e) {
    if (isApiError(e) && e.status === 409) missingEnrollment.value = true
    else if (isApiError(e) && e.status === 429) {
      contextRateLimited.value = true
      message.value = 'El servicio de personalización alcanzó temporalmente su límite. Tu estilo visual sigue disponible.'
    }
    else message.value = isApiError(e) ? e.message : 'No se pudieron consultar los datos de la credencial.'
  }
  finally {
    try {
      const blob = await profile.photo()
      clearObjectUrl(portraitUrl.value)
      portraitUrl.value = blob ? URL.createObjectURL(blob) : ''
    }
    catch { /* La fotografía debe obtenerse del backend, nunca inventarse. */ }
    loading.value = false
  }
}

async function createCurrentPdf(): Promise<Blob> {
  if (!activeQrCredential.value || !portraitUrl.value) throw new Error('Debes activar primero tu credencial.')
  const blob = await buildVisualCredentialPdf({
    nickname: context.value?.nickname || auth.nickname || 'Comprador',
    role: context.value?.role || 'COMPRADOR',
    buyerId: auth.buyerId,
    portraitUrl: portraitUrl.value,
    qrCredential: activeQrCredential.value,
    design: visualDesign.value
  })
  if (blob.size <= 5 || await blob.slice(0, 5).text() !== '%PDF-') {
    throw new Error('No se pudo construir el PDF de tu credencial.')
  }
  return blob
}

async function downloadCurrentPdf(): Promise<Blob> {
  const blob = await createCurrentPdf()
  downloadBlob(blob, 'credencial-nexttech-personalizada.pdf')
  return blob
}

async function deliverPdf(pdf: Blob): Promise<void> {
  await service.sendPersonalized(pdf, activeQrCredential.value)
  deliveryStatus.value = 'sent'
}

async function retryDelivery(): Promise<void> {
  if (qrBusy.value || !activeQrCredential.value) return
  qrBusy.value = 'send'
  message.value = ''
  try {
    const pdf = await createCurrentPdf()
    await deliverPdf(pdf)
    snackbar.success('Solicitud de envío procesada. Revisa tus canales de notificación habilitados.')
  }
  catch (e) {
    deliveryStatus.value = 'error'
    message.value = isApiError(e) ? e.message : 'No fue posible solicitar el envío. El QR sigue vigente.'
  }
  finally { qrBusy.value = null }
}

async function downloadCredential(): Promise<void> {
  if (qrBusy.value || !activeQrCredential.value) return
  qrBusy.value = 'pdf'
  message.value = ''
  try {
    await downloadCurrentPdf()
    snackbar.success('Credencial descargada. Guarda el PDF para utilizar tu QR mientras continúe vigente.')
  }
  catch (e) { message.value = e instanceof Error ? e.message : 'No se pudo descargar el PDF. Vuelve a intentarlo sin renovar tu QR.' }
  finally { qrBusy.value = null }
}

async function activateCredential(): Promise<void> {
  if (qrBusy.value || !context.value || !portraitUrl.value || missingEnrollment.value) return
  const accepted = await confirm({
    title: 'Activar mi credencial',
    message: 'NextTech generará un QR nuevo y el anterior dejará de funcionar. Se descargará y solicitará el envío de tu PDF con fotografía, stickers y QR vigente a tus canales habilitados. Conserva ese archivo: por seguridad, el código no queda guardado en este navegador. ¿Continuar?',
    confirmText: 'Activar y descargar'
  })
  if (!accepted) return
  qrBusy.value = 'issue'
  message.value = ''
  try {
    // Solamente este clic confirmado puede reemplazar el QR en Oracle.
    const result = await authService.rotateQr()
    if (typeof result.qrCredential !== 'string' || !result.qrCredential.trim()) {
      throw new Error('El backend no devolvió un código QR válido. Comprueba el estado antes de reintentar.')
    }
    activeQrCredential.value = result.qrCredential
    deliveryStatus.value = 'idle'
    const qrModule = await import('qrcode')
    const QRCode = qrModule.default ?? qrModule
    activeQrImage.value = await QRCode.toDataURL(result.qrCredential, {
      errorCorrectionLevel: 'H', margin: 2, width: 440,
      color: { dark: '#101828', light: '#FFFFFF' }
    })
  }
  catch (e) {
    message.value = isApiError(e)
      ? `${e.message} Si falló la conexión después de confirmar, el QR pudo cambiar. Verifica antes de volver a solicitar uno.`
      : e instanceof Error ? e.message : 'No se pudo activar el QR. Consulta el estado antes de reintentar.'
    qrBusy.value = null
    return
  }
  try {
    // Primero dejamos una copia local; si las notificaciones fallan NO se vuelve a rotar el QR.
    const pdf = await downloadCurrentPdf()
    snackbar.success('QR activado y PDF personalizado descargado.')
    try {
      await deliverPdf(pdf)
      snackbar.success('Solicitud de envío por correo/WhatsApp procesada según tus preferencias.')
    }
    catch (error) {
      deliveryStatus.value = 'error'
      message.value = `Tu QR sigue activo y el PDF se descargó, pero no se completó el envío: ${isApiError(error) ? error.message : 'Error de conexión'}. Usa «Reintentar envío» sin generar otro QR.`
    }
  }
  catch (e) {
    message.value = `El QR nuevo YA ESTÁ ACTIVO, pero no se descargó el PDF: ${e instanceof Error ? e.message : 'Error de generación'}. Usa «Descargar credencial» SIN generar otro QR.`
  }
  finally { qrBusy.value = null }
}

async function resetVisual(): Promise<void> {
  const accepted = await confirm({
    title: 'Restaurar estilo',
    message: 'Se quitarán los stickers y se volverá al tema azul en este navegador. No se modificará tu QR.',
    confirmText: 'Restaurar'
  })
  if (accepted) resetVisualDesign()
}

onMounted(() => void load())
onBeforeUnmount(() => {
  clearObjectUrl(portraitUrl.value)
  // Destruir la copia temporal del secreto al abandonar el editor.
  activeQrCredential.value = ''
  activeQrImage.value = ''
})
</script>

<template>
  <v-container class="py-6 px-4 px-md-8 credencial-container">
    <div class="credential-hero mb-6">
      <div class="credential-hero__badge"><v-icon icon="mdi-card-account-details-outline" color="info" size="27" /></div>
      <div>
        <div class="credential-hero__eyebrow">NEXTTECH / IDENTIDAD DIGITAL</div>
        <h1>Tu credencial. Tu estilo.</h1>
        <p>Personaliza tu credencial con stickers libres y activa tu código QR seguro desde NextTech.</p>
      </div>
    </div>

    <v-skeleton-loader v-if="loading" type="article, image" />
    <v-card v-else-if="missingEnrollment" border class="pa-5" rounded="lg">
      <p class="text-body-2 mb-4">Primero debes completar el enrolamiento frontal y el reto de vida. El diseño no altera esas verificaciones.</p>
      <FaceEnrollCard :show-credential-link="false" @enrolled="load" />
    </v-card>
    <template v-else>
      <v-alert v-if="message" :type="activeQrCredential ? 'warning' : contextRateLimited ? 'info' : 'warning'" variant="tonal" class="mb-5">
        {{ message }}
        <v-btn v-if="!context && !contextRateLimited" variant="text" @click="load">Volver a consultar datos</v-btn>
      </v-alert>
      <VisualCredentialEditor
        :model-value="visualDesign"
        :loaded="visualLoaded"
        :storage-available="storageAvailable"
        :portrait-url="portraitUrl"
        :nickname="context?.nickname || auth.nickname || 'Comprador'"
        :role="context?.role || 'COMPRADOR'"
        :sticker-options="context?.stickers || fallbackStickers"
        :qr-image-url="activeQrImage"
        :qr-ready="!!activeQrCredential"
        :qr-allowed="!!context && !!portraitUrl"
        :qr-busy="!!qrBusy"
        @update:model-value="setVisualDesign"
        @reset="resetVisual"
        @activate-credential="activateCredential"
        @download-credential="downloadCredential"
      />
      <v-alert v-if="deliveryStatus === 'error' && activeQrCredential" type="warning" variant="tonal" class="mt-4">
        Tu QR sigue vigente. Puedes reintentar el envío del PDF personalizado sin generar otro QR.
        <v-btn class="mt-2" size="small" variant="outlined" :loading="qrBusy === 'send'" :disabled="!!qrBusy" @click="retryDelivery">Reintentar envío</v-btn>
      </v-alert>
      <v-alert v-else-if="deliveryStatus === 'sent'" type="success" variant="tonal" density="compact" class="mt-4">
        Se procesó el envío de tu PDF personalizado a los canales configurados en tu cuenta.
      </v-alert>
      <v-alert v-if="activeQrCredential" type="info" variant="tonal" density="compact" class="mt-4">
        Tu QR fue activado por NextTech. Descarga y conserva el PDF; al cerrar o actualizar esta página, la vista temporal del QR se perderá, pero el código del PDF seguirá activo hasta que lo renueves o se revoque.
      </v-alert>
    </template>
  </v-container>
</template>

<style scoped>
.credencial-container{max-width:1260px}
.credential-hero{display:flex;align-items:center;gap:15px}
.credential-hero__badge{width:52px;height:52px;border:1px solid #3f6e97;background:#153654;border-radius:14px;display:grid;place-items:center;flex:none}
.credential-hero__eyebrow{font-size:10px;letter-spacing:.2em;font-weight:800;color:#55c7fc;margin-bottom:4px}
.credential-hero h1{font-size:clamp(24px,4vw,35px);line-height:1.2;font-weight:850}
.credential-hero p{font-size:13px;line-height:1.5;color:#b6c6dd;margin-top:5px}
@media(max-width:460px){.credential-hero{align-items:flex-start}}
</style>
