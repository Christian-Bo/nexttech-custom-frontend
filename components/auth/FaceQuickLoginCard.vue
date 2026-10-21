<script setup lang="ts">
import { ref } from 'vue'
import { useAuthService } from '~/services/authService'
import { isApiError } from '~/services/api'
import type { AccessTokenResultDto } from '~/types/auth'

/**
 * Login facial rápido 1:N (POST /api/auth/face-identify-login).
 *
 * El comprador no escribe nada: se captura una fotografía frontal limpia y el
 * backend lo identifica contra la galería de la Face API.
 *
 * Reglas del contrato:
 * - Se envía SOLO `image`. Sin challengeId, sin prueba de vida, sin segmentación.
 * - No se manda la foto editada del carnet ni una imagen con stickers.
 * - Máximo 5 MB; formatos JPEG, PNG o WebP.
 * - Ante un rechazo nunca se muestra información de otras identidades.
 * - Este login NO incluye prueba de vida: no sirve para acciones sensibles.
 */
const emit = defineEmits<{ success: [result: AccessTokenResultDto] }>()

/** Tope del backend por imagen. */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

const authService = useAuthService()

type Paso = 'intro' | 'captura' | 'verificando'

const paso = ref<Paso>('intro')
const error = ref<string | null>(null)
const traceId = ref<string | null>(null)

/** Mensajes por código, según la sección 4 de la actualización del backend. */
function mensajePara(e: unknown): string {
  const status = isApiError(e) ? e.status : 0
  switch (status) {
    case 400:
      return 'No pudimos usar esa fotografía. Buscá un lugar con mejor luz y probá otra vez.'
    case 401:
      // Genérico a propósito: no revelamos si el rostro existe o no en el sistema.
      return 'No pudimos reconocerte. Probá de nuevo o ingresá con tu contraseña.'
    case 409:
      return 'El ingreso con rostro no está disponible en este momento. Usá tu contraseña.'
    case 422:
      return 'No logramos identificarte con seguridad. Probá otra vez o ingresá con tu contraseña.'
    case 429:
      return 'Demasiados intentos. Esperá un momento antes de volver a intentar.'
    case 503:
      return 'El servicio de reconocimiento no está disponible ahora. Ingresá con tu contraseña.'
    default:
      return isApiError(e) ? e.message : 'No se pudo completar el ingreso con rostro.'
  }
}

async function onCapture(blob: Blob): Promise<void> {
  error.value = null
  traceId.value = null

  if (blob.size === 0) {
    error.value = 'La cámara no entregó una imagen válida. Probá otra vez.'
    paso.value = 'intro'
    return
  }
  if (blob.size > MAX_IMAGE_BYTES) {
    error.value = 'La fotografía pesa demasiado. Probá otra vez.'
    paso.value = 'intro'
    return
  }

  paso.value = 'verificando'
  try {
    emit('success', await authService.identifyLogin(blob))
  }
  catch (e) {
    error.value = mensajePara(e)
    traceId.value = isApiError(e) ? e.traceId ?? null : null
    paso.value = 'intro'
  }
}

function onCancel(): void {
  paso.value = 'intro'
}
</script>

<template>
  <div>
    <h3 class="text-subtitle-1 font-weight-bold mb-1">
      Ingresar con mi rostro
    </h3>
    <p class="text-body-2 text-medium-emphasis mb-4">
      Mirá a la cámara y te reconocemos. No tenés que escribir nada.
    </p>

    <v-alert
      v-if="error"
      type="error"
      variant="tonal"
      density="compact"
      class="mb-4"
    >
      {{ error }}
      <div
        v-if="traceId"
        class="text-caption mt-1"
      >
        Referencia para soporte: {{ traceId }}
      </div>
    </v-alert>

    <!-- Paso 1: explicación y arranque -->
    <div
      v-if="paso === 'intro'"
      class="d-flex flex-column ga-3"
    >
      <ul class="text-body-2 text-medium-emphasis pl-5 mb-0">
        <li>Buscá un lugar con buena luz.</li>
        <li>Quitate lentes oscuros, gorra o mascarilla.</li>
        <li>La foto se toma sola cuando tu rostro esté centrado.</li>
      </ul>
      <v-btn
        color="primary"
        variant="flat"
        size="large"
        class="text-none"
        prepend-icon="mdi-face-recognition"
        @click="paso = 'captura'"
      >
        Abrir la cámara
      </v-btn>
    </div>

    <!-- Paso 2: captura automática con guía de posición -->
    <AutoFaceCapture
      v-else-if="paso === 'captura'"
      @capture="onCapture"
      @cancel="onCancel"
    />

    <!-- Paso 3: el backend nos está identificando -->
    <div
      v-else
      class="verificando"
    >
      <v-progress-circular
        indeterminate
        size="56"
        width="5"
        color="accent"
      />
      <p class="text-body-1 font-weight-medium mt-4 mb-1">
        Te estamos reconociendo…
      </p>
      <p class="text-caption text-medium-emphasis">
        Esto toma un par de segundos.
      </p>
    </div>
  </div>
</template>

<style scoped>
.verificando {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 32px 8px;
}
</style>
