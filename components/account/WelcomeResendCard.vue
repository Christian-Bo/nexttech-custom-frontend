<script setup lang="ts">
import { ref, watch } from 'vue'
import type { NotificationCode } from '~/features/profile/services/profileService'
import { NOTIFICATION_OPTIONS } from '~/features/profile/services/profileService'
import { isApiError } from '~/services/api'
import { useNotificationService } from '~/services/notificationService'

const props = defineProps<{ initialChannel: NotificationCode }>()
const service = useNotificationService()
const snackbar = useSnackbar()

const channel = ref<NotificationCode>(props.initialChannel)
const sending = ref(false)
const sent = ref(false)

watch(() => props.initialChannel, (value) => { channel.value = value })
watch(channel, () => { sent.value = false })

async function resend(): Promise<void> {
  if (sending.value || sent.value) return
  sending.value = true
  try {
    await service.resendWelcome(channel.value)
    sent.value = true
    snackbar.success('Solicitud procesada. Revisa el canal que seleccionaste.')
  }
  catch (e) {
    if (isApiError(e) && e.status === 404) {
      snackbar.warning('Esta función todavía no está disponible en el servidor publicado.')
    }
    else {
      snackbar.error(isApiError(e) ? e : 'No pudimos reenviar la bienvenida.')
    }
  }
  finally {
    sending.value = false
  }
}
</script>

<template>
  <div class="account-action">
    <h3 class="account-action__heading">
      <v-icon icon="mdi-email-fast-outline" size="20" color="secondary" />
      Reenviar mensaje de bienvenida
    </h3>
    <p class="text-body-2 text-medium-emphasis mb-4">
      Recibe nuevamente los datos generales de tu cuenta en el canal que prefieras.
    </p>
    <v-select
      v-model="channel"
      :items="NOTIFICATION_OPTIONS"
      item-title="name"
      item-value="code"
      label="Enviar por"
      variant="outlined"
      density="comfortable"
      prepend-inner-icon="mdi-send-outline"
      :disabled="sending"
      hide-details="auto"
      class="mb-3"
    />
    <v-btn
      color="secondary"
      variant="tonal"
      block
      class="text-none"
      prepend-icon="mdi-email-send-outline"
      :loading="sending"
      :disabled="sending || sent"
      @click="resend"
    >
      {{ sent ? 'Solicitud enviada' : 'Reenviar bienvenida' }}
    </v-btn>
    <p v-if="sent" class="text-caption text-medium-emphasis mt-2" role="status">
      Si necesitas otro canal, selecciónalo arriba.
    </p>
  </div>
</template>

<style scoped>
.account-action { min-width: 0; }
.account-action__heading {
  display: flex; align-items: center; flex-wrap: wrap; gap: 8px;
  font-size: 1rem; font-weight: 700; margin-bottom: 8px;
}
</style>
