<script setup lang="ts">
import { isApiError } from '~/services/api'
import { useAuthService } from '~/services/authService'
import { useAuthStore } from '~/stores/auth'
import type { QrValidationResult } from '~/composables/useQrScanner'
import type { AccessTokenResultDto } from '~/types/auth'

/** Login del comprador escaneando su QR (credencial). Emite `success` con la sesión ya guardada. */
const emit = defineEmits<{ success: [result: AccessTokenResultDto] }>()

const authService = useAuthService()
const auth = useAuthStore()

async function validate(code: string): Promise<QrValidationResult> {
  try {
    const result = await authService.qrLogin(code)
    auth.setSession(result)
    emit('success', result)
    return { ok: true, message: '¡Bienvenido! Ingresando…' }
  }
  catch (e) {
    const status = isApiError(e) ? e.status : 0
    if (status === 401 || status === 400) return { ok: false, message: 'Este QR no es válido o ya fue reemplazado.' }
    if (status === 403) return { ok: false, message: 'Tu cuenta está bloqueada o inactiva.' }
    return { ok: false, message: isApiError(e) ? e.message : 'No se pudo validar el QR.' }
  }
}
</script>

<template>
  <QrScanner
    title="Ingresa con tu código QR"
    :validate="validate"
  />
</template>
