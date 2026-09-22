<!--
  Página TEMPORAL: solo verifica que el theme NextTech carga bien.
  La reemplaza Integrante 4 con el home/catálogo real.
-->
<script setup lang="ts">
import { ref } from 'vue'
import { ORDER_STATUS } from '~/types/domain'

const snackbar = useSnackbar()
const { confirm } = useConfirm()
const statuses = Object.values(ORDER_STATUS)
const confirmResult = ref<string>('')

async function probarConfirm() {
  const ok = await confirm({
    title: '¿Eliminar este diseño?',
    message: 'Esta acción no se puede deshacer.',
    confirmText: 'Eliminar',
    danger: true
  })
  confirmResult.value = ok ? 'Confirmado' : 'Cancelado'
  if (ok) snackbar.success('Diseño eliminado')
}

const cameraOpen = ref(false)
const photoUrl = ref<string | null>(null)

function onPhoto(blob: Blob) {
  if (photoUrl.value) URL.revokeObjectURL(photoUrl.value)
  photoUrl.value = URL.createObjectURL(blob)
  cameraOpen.value = false
  snackbar.success('Foto capturada')
}

// Validación MOCK: en producción la hace el backend.
async function validarQr(code: string) {
  await new Promise(r => setTimeout(r, 500))
  return code.startsWith('NT-')
    ? { ok: true, message: `Código válido: ${code}` }
    : { ok: false, message: 'Código no reconocido (prueba con uno que empiece con NT-)' }
}

const palette = [
  { name: 'Fondo', token: '--nt-bg', hex: '#0F172A' },
  { name: 'Superficie', token: '--nt-surface', hex: '#1E293B' },
  { name: 'Elevado', token: '--nt-surface-elevated', hex: '#334155' },
  { name: 'Principal', token: '--nt-primary', hex: '#2563EB' },
  { name: 'Acento', token: '--nt-accent', hex: '#06B6D4' },
  { name: 'Éxito', token: '--nt-success', hex: '#22C55E' },
  { name: 'Advertencia', token: '--nt-warning', hex: '#F59E0B' },
  { name: 'Error', token: '--nt-error', hex: '#EF4444' }
]
</script>

<template>
  <v-container class="py-10">
    <h1 class="text-h4 font-weight-bold mb-2">
      NextTech Custom
    </h1>
    <p class="text-medium-emphasis mb-8">
      Tema base cargado. Esta página es temporal.
    </p>

    <v-row>
      <v-col
        v-for="c in palette"
        :key="c.token"
        cols="6"
        sm="4"
        md="3"
      >
        <v-card
          variant="flat"
          border
        >
          <div
            class="swatch"
            :style="{ background: `var(${c.token})` }"
          />
          <v-card-text>
            <div class="font-weight-medium">
              {{ c.name }}
            </div>
            <code class="text-caption text-medium-emphasis">{{ c.hex }}</code>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <div class="d-flex flex-wrap ga-3 mt-8">
      <v-btn color="primary">
        Principal
      </v-btn>
      <v-btn
        color="accent"
        variant="tonal"
      >
        Acento
      </v-btn>
      <v-btn variant="outlined">
        Secundario
      </v-btn>
      <v-chip color="success">
        Entregado
      </v-chip>
      <v-chip color="warning">
        En elaboración
      </v-chip>
      <v-chip color="error">
        Comprador no encontrado
      </v-chip>
    </div>

    <h2 class="text-h6 font-weight-bold mt-12 mb-4">
      Componentes UI (demo temporal)
    </h2>

    <div class="d-flex flex-wrap ga-2 mb-6">
      <v-btn variant="tonal" color="success" @click="snackbar.success('Guardado correctamente')">Aviso éxito</v-btn>
      <v-btn variant="tonal" color="error" @click="snackbar.error('No se pudo guardar')">Aviso error</v-btn>
      <v-btn variant="tonal" color="warning" @click="snackbar.warning('Revisa la imagen')">Aviso advertencia</v-btn>
      <v-btn variant="tonal" color="info" @click="snackbar.info('Tienes cambios sin guardar')">Aviso info</v-btn>
      <v-btn variant="outlined" @click="probarConfirm">Confirmación</v-btn>
      <span v-if="confirmResult" class="align-self-center text-medium-emphasis">→ {{ confirmResult }}</span>
    </div>

    <div class="d-flex flex-wrap ga-2 mb-6">
      <StatusChip v-for="s in statuses" :key="s" :status="s" />
    </div>

    <v-row>
      <v-col cols="12" md="6">
        <v-card border variant="flat">
          <StateEmpty title="Aún no tienes pedidos" description="Cuando compres algo, aparecerá aquí.">
            <template #actions>
              <v-btn color="primary">Ver catálogo</v-btn>
            </template>
          </StateEmpty>
        </v-card>
      </v-col>
      <v-col cols="12" md="6">
        <v-card border variant="flat">
          <StateError
            :error="{ status: 503, code: 'SERVICE_UNAVAILABLE', message: 'El servicio no está disponible en este momento.' }"
            @retry="snackbar.info('Reintentando…')"
          />
        </v-card>
      </v-col>
    </v-row>

    <h2 class="text-h6 font-weight-bold mt-12 mb-4">
      Operación (demo temporal)
    </h2>
    <div class="d-flex flex-wrap ga-2 mb-6">
      <v-btn color="primary" prepend-icon="mdi-palette" to="/personalizar">Abrir editor</v-btn>
    </div>
    <v-row>
      <v-col cols="12" md="6">
        <v-card border variant="flat" class="pa-4">
          <h3 class="text-subtitle-1 font-weight-semibold mb-3">Cámara</h3>
          <ClientOnly>
            <CameraCapture v-if="cameraOpen" @capture="onPhoto" @cancel="cameraOpen = false" />
            <div v-else class="d-flex flex-column align-center ga-3">
              <img v-if="photoUrl" :src="photoUrl" alt="Foto capturada" style="max-width: 100%; border-radius: 10px">
              <v-btn prepend-icon="mdi-camera" @click="cameraOpen = true">Probar cámara</v-btn>
            </div>
          </ClientOnly>
        </v-card>
      </v-col>
      <v-col cols="12" md="6">
        <v-card border variant="flat" class="pa-4">
          <ClientOnly>
            <QrScanner :validate="validarQr" :auto-start="false" @valid="(c: string) => snackbar.success(`QR aceptado: ${c}`)" />
          </ClientOnly>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
.swatch {
  height: 72px;
  border-bottom: 1px solid var(--nt-border);
}
</style>
