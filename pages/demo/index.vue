<!--
  Vitrina de los módulos del Integrante 5 (Personalización y Operación).
  Página de demostración para el equipo y la presentación.
-->
<script setup lang="ts">
import { ref } from 'vue'
import { ORDER_STATUS } from '~/types/domain'

useHead({ title: 'Demo · NextTech Custom' })

const snackbar = useSnackbar()
const { confirm } = useConfirm()
const statuses = Object.values(ORDER_STATUS)

const cameraOpen = ref(false)
const photoUrl = ref<string | null>(null)

const MODULES = [
  { to: '/catalogo', icon: 'mdi-storefront-outline', title: 'Tienda del comprador', text: 'Catálogo, carrito, checkout con área de entrega y pago, y mis pedidos.' },
  { to: '/personalizar', icon: 'mdi-palette-outline', title: 'Editor de personalización', text: 'Llavero Lado A/B, texto, imágenes, stickers, filtros, deshacer y giro 3D.' },
  { to: '/repartidor', icon: 'mdi-truck-delivery-outline', title: 'App del repartidor', text: 'Pedidos, QR del comprador, cobro, foto de evidencia y no encontrado.' },
  { to: '/mi-foto?nuevo=1', icon: 'mdi-account-box-outline', title: 'Foto y credencial del registro', text: 'Recorte del rostro, filtros, stickers, original vs. modificada y credencial PDF.' },
  { to: '/demo/acceso', icon: 'mdi-shield-account-outline', title: 'Acceso con QR y rostro', text: 'Login por QR, login facial con prueba de vida y credencial PDF.' },
  { to: '/seguimiento/NTC-1045', icon: 'mdi-map-marker-path', title: 'Seguimiento en tiempo real', text: 'Línea de tiempo que cambia sola y QR de entrega para el comprador.' },
  { to: '/panel', icon: 'mdi-view-dashboard-outline', title: 'Dashboard de operaciones', text: 'KPIs en vivo, ventas por día, pedidos por estado y últimos pedidos.' },
  { to: '/panel/presentacion', icon: 'mdi-presentation', title: 'Dashboard en pantalla completa', text: 'Modo presentación con cifras grandes, reloj y actualización automática.' },
  { to: '/panel/produccion', icon: 'mdi-hammer-wrench', title: 'Producción (supervisor)', text: 'Cola de elaboración con cronómetro de 60 s y "Marcar listo para entrega".' },
  { to: '/interno', icon: 'mdi-badge-account-horizontal-outline', title: 'Acceso del personal', text: 'Login de repartidor, supervisor y admin, con cambio obligatorio de contraseña.' }
]

async function probarConfirm() {
  const ok = await confirm({ title: '¿Eliminar este diseño?', message: 'Esta acción no se puede deshacer.', confirmText: 'Eliminar', danger: true })
  snackbar[ok ? 'success' : 'info'](ok ? 'Diseño eliminado' : 'Cancelado')
}

function onPhoto(blob: Blob) {
  if (photoUrl.value) URL.revokeObjectURL(photoUrl.value)
  photoUrl.value = URL.createObjectURL(blob)
  cameraOpen.value = false
}

// Validación simulada: en producción la hace el backend.
async function validarQr(code: string) {
  await new Promise(r => setTimeout(r, 400))
  return code.startsWith('NT-')
    ? { ok: true, message: `Código válido: ${code}` }
    : { ok: false, message: 'Código no reconocido (prueba uno que empiece con NT-)' }
}
</script>

<template>
  <v-container
    class="py-10"
    style="max-width: 1100px"
  >
    <h1 class="text-h5 font-weight-bold mb-1">
      Demo · Personalización y Operación
    </h1>
    <p class="text-medium-emphasis mb-8">
      Módulos del Integrante 5. Los que aún no tienen backend usan datos simulados.
    </p>

    <v-row class="mb-8">
      <v-col
        v-for="m in MODULES"
        :key="m.to"
        cols="12"
        md="4"
      >
        <v-card
          :to="m.to"
          border
          variant="flat"
          class="pa-5 h-100"
        >
          <v-icon
            :icon="m.icon"
            size="36"
            color="primary"
            class="mb-3"
          />
          <h2 class="text-subtitle-1 font-weight-bold mb-1">
            {{ m.title }}
          </h2>
          <p class="text-body-2 text-medium-emphasis">
            {{ m.text }}
          </p>
        </v-card>
      </v-col>
    </v-row>

    <h2 class="text-h6 font-weight-bold mb-4">
      Componentes compartidos
    </h2>
    <div class="d-flex flex-wrap ga-2 mb-4">
      <v-btn
        variant="tonal"
        color="success"
        @click="snackbar.success('Guardado correctamente')"
      >
        Aviso éxito
      </v-btn>
      <v-btn
        variant="tonal"
        color="error"
        @click="snackbar.error('No se pudo guardar')"
      >
        Aviso error
      </v-btn>
      <v-btn
        variant="outlined"
        @click="probarConfirm"
      >
        Confirmación
      </v-btn>
    </div>
    <div class="d-flex flex-wrap ga-2 mb-8">
      <StatusChip
        v-for="s in statuses"
        :key="s"
        :status="s"
      />
    </div>

    <v-row>
      <v-col
        cols="12"
        md="6"
      >
        <v-card
          border
          variant="flat"
          class="pa-4"
        >
          <h3 class="text-subtitle-1 font-weight-semibold mb-3">
            Cámara
          </h3>
          <ClientOnly>
            <CameraCapture
              v-if="cameraOpen"
              @capture="onPhoto"
              @cancel="cameraOpen = false"
            />
            <div
              v-else
              class="d-flex flex-column align-center ga-3"
            >
              <img
                v-if="photoUrl"
                :src="photoUrl"
                alt="Foto capturada"
                style="max-width: 100%; border-radius: 10px"
              >
              <v-btn
                prepend-icon="mdi-camera"
                @click="cameraOpen = true"
              >
                Probar cámara
              </v-btn>
            </div>
          </ClientOnly>
        </v-card>
      </v-col>
      <v-col
        cols="12"
        md="6"
      >
        <v-card
          border
          variant="flat"
          class="pa-4"
        >
          <ClientOnly>
            <QrScanner
              :validate="validarQr"
              :auto-start="false"
              @valid="(c: string) => snackbar.success(`QR aceptado: ${c}`)"
            />
          </ClientOnly>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
