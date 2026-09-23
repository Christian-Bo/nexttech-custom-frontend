<script setup lang="ts">
import { ref } from 'vue'
import { isApiError } from '~/services/api'
import { downloadBlob, useCredentialService } from '~/services/credentialService'

/** Emite y descarga la credencial PDF. Advierte que el QR anterior deja de funcionar. */
const credentialService = useCredentialService()
const snackbar = useSnackbar()
const { confirm } = useConfirm()
const loading = ref(false)

async function issue(): Promise<void> {
  const ok = await confirm({
    title: '¿Generar una nueva credencial?',
    message: 'Se creará un código QR nuevo y el anterior dejará de funcionar. También te la enviaremos por correo.',
    confirmText: 'Generar'
  })
  if (!ok) return

  loading.value = true
  try {
    const pdf = await credentialService.issue()
    downloadBlob(pdf, 'credencial-nexttech.pdf')
    snackbar.success('Credencial descargada. Guárdala en un lugar seguro.')
  }
  catch (e) {
    const status = isApiError(e) ? e.status : 0
    if (status === 409) snackbar.warning('Primero registra tu rostro para obtener tu credencial.')
    else if (status === 429) snackbar.warning('Generaste varias credenciales seguidas. Espera unos minutos.')
    else snackbar.error(isApiError(e) ? e : 'No se pudo generar la credencial.')
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <v-btn
    color="primary"
    prepend-icon="mdi-card-account-details-outline"
    :loading="loading"
    @click="issue"
  >
    Descargar mi credencial
  </v-btn>
</template>
