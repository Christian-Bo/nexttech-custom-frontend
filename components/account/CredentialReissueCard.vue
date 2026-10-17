<script setup lang="ts">
import { ref, shallowRef, watch } from 'vue'
import type { NotificationCode } from '~/features/profile/services/profileService'
import { NOTIFICATION_OPTIONS } from '~/features/profile/services/profileService'
import { isApiError } from '~/services/api'
import { downloadBlob, useCredentialService } from '~/services/credentialService'

const props = defineProps<{ initialChannel: NotificationCode }>()
const service = useCredentialService()
const snackbar = useSnackbar()
const { confirm } = useConfirm()

const channel = ref<NotificationCode>(props.initialChannel)
const working = ref(false)
const lastPdf = shallowRef<Blob | null>(null)
const unknownResult = ref(false)

watch(() => props.initialChannel, value => { channel.value = value })

async function validatePdf(data: Blob): Promise<boolean> {
  return data.size > 5 && (await data.slice(0, 5).text()) === '%PDF-'
}

function downloadAgain(): void {
  if (lastPdf.value) downloadBlob(lastPdf.value, 'credencial-nexttech-reemitida.pdf')
}

async function reissue(): Promise<void> {
  if (working.value || lastPdf.value || unknownResult.value) return
  const accepted = await confirm({
    title: '¿Reemitir tu credencial?',
    message: 'El código QR anterior quedará invalidado. Esta acción no cambia tu fotografía ni tus stickers guardados en el navegador, pero el PDF nuevo se generará con el diseño y la foto del servidor. ¿Deseas continuar?',
    confirmText: 'Sí, generar nueva',
    cancelText: 'Cancelar',
    danger: true
  })
  if (!accepted || working.value) return

  working.value = true
  try {
    const pdf = await service.reissue(channel.value)
    if (!(pdf instanceof Blob) || !(await validatePdf(pdf))) {
      // La operación pudo haber ocurrido aun si no llegó un PDF legible.
      unknownResult.value = true
      snackbar.warning('No recibimos un PDF válido. Verifica la credencial recibida antes de intentar nuevamente.')
      return
    }

    lastPdf.value = pdf // conservar en memoria para redescargar sin invalidar otro QR
    try {
      downloadAgain()
      snackbar.success('Nueva credencial emitida. Descargamos el PDF y se envió por el canal seleccionado.')
    }
    catch {
      snackbar.warning('La credencial fue emitida, pero no se pudo descargar. Usa el botón «Volver a descargar».')
    }
  }
  catch (e) {
    if (isApiError(e) && e.status === 409) {
      snackbar.warning(e.message)
    }
    else if (isApiError(e) && e.status === 429) {
      snackbar.warning('Demasiadas solicitudes. Espera unos minutos antes de intentarlo.')
    }
    else if (isApiError(e) && e.status === 404) {
      snackbar.warning('La reemisión todavía no está publicada en el servidor.')
    }
    else if (!isApiError(e) || e.status === 0 || e.status >= 500) {
      // El backend activa el QR antes de terminar los envíos; el estado puede ser incierto.
      unknownResult.value = true
      snackbar.warning('No pudimos confirmar el resultado. Revisa correo o WhatsApp antes de volver a solicitar otra credencial.')
    }
    else {
      snackbar.error(e)
    }
  }
  finally {
    working.value = false
  }
}
</script>

<template>
  <div class="account-action">
    <h3 class="account-action__heading">
      <v-icon icon="mdi-card-account-details-star-outline" size="20" color="secondary" />
      Reemitir credencial perdida
    </h3>
    <p class="text-body-2 text-medium-emphasis mb-3">
      Si perdiste tu credencial, solicita una nueva y recíbela por correo, WhatsApp o ambos.
    </p>
    <v-alert
      type="warning"
      variant="tonal"
      density="compact"
      icon="mdi-alert-outline"
      class="mb-4"
    >
      El QR de tu credencial anterior dejará de funcionar, incluso si lo tienes en un PDF personalizado.
    </v-alert>
    <v-select
      v-model="channel"
      :items="NOTIFICATION_OPTIONS"
      item-title="name"
      item-value="code"
      label="Canal de entrega"
      variant="outlined"
      density="comfortable"
      prepend-inner-icon="mdi-send-outline"
      hide-details="auto"
      :disabled="working || !!lastPdf || unknownResult"
      class="mb-3"
    />
    <v-btn
      v-if="!lastPdf"
      color="secondary"
      variant="tonal"
      class="text-none"
      block
      prepend-icon="mdi-card-account-details-outline"
      :loading="working"
      :disabled="working || unknownResult"
      @click="reissue"
    >
      Generar nueva credencial
    </v-btn>
    <v-btn
      v-else
      color="primary"
      class="text-none"
      block
      prepend-icon="mdi-download-outline"
      @click="downloadAgain"
    >
      Volver a descargar PDF
    </v-btn>
    <p v-if="lastPdf" class="text-caption text-medium-emphasis mt-2" role="status">
      La nueva credencial ya fue emitida. Puedes descargar este mismo PDF otra vez sin crear un QR distinto.
    </p>
    <v-alert
      v-if="unknownResult"
      type="info"
      variant="tonal"
      density="compact"
      class="mt-3"
      role="status"
    >
      Revisa tus mensajes antes de repetir el proceso. Si no recibiste el PDF, solicita ayuda para confirmar cuál QR sigue activo.
    </v-alert>
  </div>
</template>

<style scoped>
.account-action { min-width: 0; }
.account-action__heading {
  display: flex; align-items: center; flex-wrap: wrap; gap: 8px;
  font-size: 1rem; font-weight: 700; margin-bottom: 8px;
}
</style>
