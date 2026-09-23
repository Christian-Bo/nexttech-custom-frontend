<!--
  DEMO de las piezas de acceso (Integrante 5) sobre el backend real del Integrante 2.
  Las pantallas finales de login/registro las arma Integrante 4 usando estos componentes.
-->
<script setup lang="ts">
import { ref } from 'vue'
import { isApiError } from '~/services/api'
import { useAuthService } from '~/services/authService'
import { useAuthStore } from '~/stores/auth'

useHead({ title: 'Demo acceso · NextTech Custom' })

const auth = useAuthStore()
const authService = useAuthService()
const snackbar = useSnackbar()

const tab = ref<'qr' | 'face' | 'enroll' | 'credential'>('qr')
const identifier = ref('')
const password = ref('')
const loggingIn = ref(false)

async function passwordLogin(): Promise<void> {
  loggingIn.value = true
  try {
    auth.setSession(await authService.login({ identifier: identifier.value.trim(), password: password.value }))
    password.value = ''
    snackbar.success('Sesión iniciada')
  }
  catch (e) {
    snackbar.error(isApiError(e) && e.status === 401 ? 'Correo/nickname o contraseña incorrectos.' : isApiError(e) ? e : 'Error')
  }
  finally {
    loggingIn.value = false
  }
}

function onLogin(): void {
  snackbar.success(`¡Hola, ${auth.nickname ?? 'comprador'}!`)
}
</script>

<template>
  <v-container
    class="py-8"
    style="max-width: 1100px"
  >
    <h1 class="text-h5 font-weight-bold mb-1">
      Acceso del comprador (demo)
    </h1>
    <p class="text-medium-emphasis mb-6">
      Piezas reutilizables: QR, rostro y credencial. Conectadas al backend real.
    </p>

    <v-row>
      <!-- Sesión -->
      <v-col
        cols="12"
        md="4"
      >
        <v-card
          border
          variant="flat"
          class="pa-4"
        >
          <h3 class="text-subtitle-1 font-weight-semibold mb-3">
            Sesión
          </h3>
          <template v-if="auth.isAuthenticated">
            <div class="d-flex align-center ga-2 mb-3">
              <v-avatar
                color="primary"
                size="36"
              >
                <v-icon icon="mdi-account" />
              </v-avatar>
              <div>
                <div class="font-weight-medium">
                  {{ auth.nickname ?? 'Comprador' }}
                </div>
                <div class="text-caption text-medium-emphasis">
                  {{ auth.actorType }} · id {{ auth.buyerId }}
                </div>
              </div>
            </div>
            <v-btn
              variant="tonal"
              color="error"
              block
              @click="auth.clearSession()"
            >
              Cerrar sesión
            </v-btn>
          </template>
          <form
            v-else
            class="d-flex flex-column ga-3"
            @submit.prevent="passwordLogin"
          >
            <v-text-field
              v-model="identifier"
              label="Correo o nickname"
              density="compact"
              hide-details
              autocomplete="username"
            />
            <v-text-field
              v-model="password"
              label="Contraseña"
              type="password"
              density="compact"
              hide-details
              autocomplete="current-password"
            />
            <v-btn
              type="submit"
              color="primary"
              :loading="loggingIn"
            >
              Ingresar con contraseña
            </v-btn>
            <p class="text-caption text-medium-emphasis">
              Necesario para "Registrar rostro" y "Credencial".
            </p>
          </form>
        </v-card>
      </v-col>

      <!-- Piezas -->
      <v-col
        cols="12"
        md="8"
      >
        <v-card
          border
          variant="flat"
        >
          <v-tabs
            v-model="tab"
            color="primary"
            show-arrows
          >
            <v-tab
              value="qr"
              prepend-icon="mdi-qrcode-scan"
            >
              Ingresar con QR
            </v-tab>
            <v-tab
              value="face"
              prepend-icon="mdi-face-recognition"
            >
              Ingresar con rostro
            </v-tab>
            <v-tab
              value="enroll"
              prepend-icon="mdi-account-check-outline"
            >
              Registrar rostro
            </v-tab>
            <v-tab
              value="credential"
              prepend-icon="mdi-card-account-details-outline"
            >
              Credencial
            </v-tab>
          </v-tabs>

          <v-card-text class="pa-5">
            <ClientOnly>
              <QrLoginCard
                v-if="tab === 'qr'"
                @success="onLogin"
              />
              <FaceLoginCard
                v-else-if="tab === 'face'"
                @success="onLogin"
              />
              <template v-else-if="!auth.isAuthenticated">
                <StateEmpty
                  icon="mdi-lock-outline"
                  title="Inicia sesión primero"
                  description="Usa el formulario de la izquierda."
                />
              </template>
              <FaceEnrollCard v-else-if="tab === 'enroll'" />
              <div
                v-else
                class="d-flex flex-column align-center ga-3 py-6 text-center"
              >
                <v-icon
                  icon="mdi-card-account-details-outline"
                  size="56"
                />
                <p class="text-body-2 text-medium-emphasis">
                  PDF con tu foto, nickname y un QR nuevo para ingresar. Requiere rostro registrado.
                </p>
                <CredentialDownloadButton />
              </div>
            </ClientOnly>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
