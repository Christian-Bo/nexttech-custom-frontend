<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import PortraitStudio from '~/features/photo-studio/components/PortraitStudio.vue'
import { loadPortrait, savePortrait } from '~/features/photo-studio/services/portraitStorage'
import type { StoredPortrait } from '~/features/photo-studio/services/portraitStorage'
import { useCredentialQr } from '~/features/photo-studio/services/credentialQr'
import { buildCredentialPdf, credentialFileName, formatIssuedAt } from '~/features/photo-studio/utils/credentialPdf'
import type { PortraitState } from '~/features/photo-studio/utils/portrait'
import { downloadBlob } from '~/services/credentialService'
import { isApiError } from '~/services/api'

/**
 * Paso 2 y 3 del registro: foto (recorte, filtros, stickers) y credencial PDF con la foto modificada.
 * En modo demo se puede abrir sin sesión.
 */
definePageMeta({
  middleware: [
    (to) => {
      if (useRuntimeConfig().public.useMocks) return
      if (!useAuthStore().isAuthenticated) return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
    }
  ]
})
useHead({ title: 'Mi foto y credencial | NextTech Custom' })

const route = useRoute()
const auth = useAuthStore()
const snackbar = useSnackbar()
const { confirm } = useConfirm()
const qr = useCredentialQr()

const isNew = computed(() => route.query.nuevo === '1')
const portrait = ref<StoredPortrait | null>(null)
const step = ref<'foto' | 'credencial'>('foto')
const downloading = ref(false)
const startedAt = Date.now()
const seconds = ref<number | null>(null)

const nickname = computed(() => auth.nickname ?? 'Comprador demo')
const today = formatIssuedAt(new Date())

onMounted(() => {
  portrait.value = loadPortrait(auth.buyerId)
  if (portrait.value && !isNew.value) step.value = 'credencial'
})

function onSaved(value: { original: string, modified: string, state: PortraitState }): void {
  const next: StoredPortrait = { ...value, updatedAt: new Date().toISOString() }
  portrait.value = next
  if (!savePortrait(auth.buyerId, next)) {
    snackbar.warning('Tu foto está lista, pero el navegador no permitió guardarla para después.')
  }
  if (isNew.value && seconds.value === null) seconds.value = Math.round((Date.now() - startedAt) / 1000)
  step.value = 'credencial'
  snackbar.success('¡Foto guardada!')
}

async function download(): Promise<void> {
  if (!portrait.value) return
  if (qr.willRotate.value) {
    const ok = await confirm({
      title: '¿Generar una nueva credencial?',
      message: 'Se creará un código QR nuevo y el anterior dejará de funcionar.',
      confirmText: 'Generar'
    })
    if (!ok) return
  }
  downloading.value = true
  try {
    const qrCredential = await qr.obtain(auth.buyerId)
    const pdf = await buildCredentialPdf({
      nickname: nickname.value,
      buyerId: auth.buyerId,
      qrCredential,
      portrait: portrait.value.modified,
      issuedAt: new Date()
    })
    downloadBlob(pdf, credentialFileName(nickname.value))
    snackbar.success('Credencial descargada. Guárdala en un lugar seguro.')
  }
  catch (e) {
    console.error('[credencial]', e)
    snackbar.error(isApiError(e) ? e : 'No se pudo generar la credencial.')
  }
  finally {
    downloading.value = false
  }
}
</script>

<template>
  <v-container
    class="py-8"
    style="max-width: 960px"
  >
    <ol class="pasos">
      <li class="pasos__item pasos__item--hecho">
        <span class="pasos__num"><v-icon
          icon="mdi-check"
          size="14"
        /></span> Datos
      </li>
      <li
        class="pasos__item"
        :class="step === 'foto' ? 'pasos__item--activo' : 'pasos__item--hecho'"
      >
        <span class="pasos__num">
          <v-icon
            v-if="step !== 'foto'"
            icon="mdi-check"
            size="14"
          />
          <template v-else>2</template>
        </span> Foto
      </li>
      <li
        class="pasos__item"
        :class="{ 'pasos__item--activo': step === 'credencial' }"
      >
        <span class="pasos__num">3</span> Credencial
      </li>
    </ol>

    <template v-if="step === 'foto'">
      <h1 class="text-h4 font-weight-bold mb-2">
        Tu foto de perfil
      </h1>
      <p class="text-medium-emphasis mb-6">
        Recorta tu rostro y dale tu estilo con filtros y stickers. Esta foto aparecerá en tu credencial.
      </p>
      <PortraitStudio @saved="onSaved" />
    </template>

    <template v-else-if="portrait">
      <h1 class="text-h4 font-weight-bold mb-2">
        Tu credencial
      </h1>
      <p class="text-medium-emphasis mb-6">
        Descárgala en PDF y muéstrala para ingresar con tu código QR.
        <span v-if="seconds !== null">Terminaste tu foto en {{ seconds }} s.</span>
      </p>

      <div class="credencial">
        <div class="credencial__fotos">
          <figure>
            <img
              :src="portrait.original"
              alt="Foto original"
              class="credencial__original"
            >
            <figcaption>Original</figcaption>
          </figure>
          <v-icon
            icon="mdi-arrow-right"
            color="accent"
          />
          <figure>
            <img
              :src="portrait.modified"
              alt="Foto modificada"
              class="credencial__modificada"
            >
            <figcaption>Para tu credencial</figcaption>
          </figure>
        </div>

        <!-- Vista previa de la credencial -->
        <div
          class="tarjeta"
          aria-label="Vista previa de la credencial"
        >
          <div class="tarjeta__cabecera">
            <strong>NextTech Custom</strong>
            <span>Credencial digital del comprador</span>
          </div>
          <img
            :src="portrait.modified"
            alt=""
            class="tarjeta__foto"
          >
          <div class="tarjeta__nombre">
            {{ nickname }}
          </div>
          <div class="tarjeta__rol">
            COMPRADOR
          </div>
          <div class="tarjeta__qr">
            <v-icon
              icon="mdi-qrcode"
              size="56"
              color="#0F172A"
            />
          </div>
          <div class="tarjeta__pie">
            ID {{ auth.buyerId ?? '—' }} · {{ today }}
          </div>
        </div>
      </div>

      <v-alert
        v-if="qr.willRotate.value"
        type="info"
        variant="tonal"
        density="compact"
        class="mt-6"
      >
        Al descargar se genera un QR nuevo y el anterior deja de funcionar.
      </v-alert>

      <div class="d-flex flex-wrap ga-3 mt-6">
        <v-btn
          variant="tonal"
          prepend-icon="mdi-pencil-outline"
          @click="step = 'foto'"
        >
          Editar foto
        </v-btn>
        <v-spacer />
        <v-btn
          v-if="auth.isAuthenticated"
          to="/"
          variant="text"
        >
          Ir a la tienda
        </v-btn>
        <v-btn
          color="primary"
          size="large"
          prepend-icon="mdi-file-download-outline"
          :loading="downloading"
          @click="download"
        >
          Descargar credencial (PDF)
        </v-btn>
      </div>
    </template>
  </v-container>
</template>

<style scoped>
.pasos {
  display: flex;
  gap: 8px;
  list-style: none;
  padding: 0;
  margin: 0 0 28px;
  flex-wrap: wrap;
}

.pasos__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px 6px 6px;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.3);
  color: rgba(248, 250, 252, 0.6);
  font-size: 0.875rem;
}

.pasos__item--activo {
  border-color: rgb(var(--v-theme-accent));
  color: rgb(var(--v-theme-on-surface));
  font-weight: 600;
}

.pasos__item--hecho {
  color: rgb(var(--v-theme-on-surface));
}

.pasos__num {
  display: inline-grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(148, 163, 184, 0.2);
  font-size: 0.75rem;
  font-weight: 700;
}

.pasos__item--activo .pasos__num {
  background: rgb(var(--v-theme-accent));
  color: #0f172a;
}

.pasos__item--hecho .pasos__num {
  background: rgb(var(--v-theme-success));
  color: #0f172a;
}

.credencial {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 260px;
  gap: 32px;
  align-items: center;
}

.credencial__fotos {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.credencial__fotos figure {
  margin: 0;
  text-align: center;
  font-size: 0.8rem;
  color: rgba(248, 250, 252, 0.7);
}

.credencial__fotos img {
  display: block;
  width: 100%;
  max-width: 200px;
  aspect-ratio: 3 / 4;
  object-fit: cover;
  border-radius: 10px;
  margin-bottom: 6px;
}

.credencial__original {
  opacity: 0.85;
}

.tarjeta {
  background: #0f172a;
  border: 1px solid rgba(148, 163, 184, 0.3);
  border-radius: 16px;
  overflow: hidden;
  text-align: center;
  padding-bottom: 14px;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.35);
}

.tarjeta__cabecera {
  background: #2563eb;
  color: #fff;
  padding: 10px;
  display: flex;
  flex-direction: column;
  font-size: 0.7rem;
}

.tarjeta__cabecera strong {
  font-size: 1rem;
}

.tarjeta__foto {
  display: block;
  margin-inline: auto;
  width: 110px;
  aspect-ratio: 3 / 4;
  object-fit: cover;
  border-radius: 8px;
  border: 3px solid #06b6d4;
  margin-top: 14px;
}

.tarjeta__nombre {
  font-weight: 700;
  font-size: 1.1rem;
  margin-top: 8px;
}

.tarjeta__rol {
  color: #06b6d4;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.tarjeta__qr {
  display: inline-grid;
  place-items: center;
  width: 84px;
  height: 84px;
  background: #fff;
  border-radius: 8px;
  margin-top: 10px;
}

.tarjeta__pie {
  font-size: 0.7rem;
  color: rgba(148, 163, 184, 0.9);
  margin-top: 10px;
}

@media (max-width: 760px) {
  .credencial {
    grid-template-columns: minmax(0, 1fr);
  }

  .tarjeta {
    max-width: 260px;
    margin: 0 auto;
    width: 100%;
  }
}
</style>
