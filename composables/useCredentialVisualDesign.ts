import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useAuthStore } from '~/stores/auth'
import {
  defaultVisualCredentialDesign,
  normalizeVisualCredentialDesign,
  visualCredentialStorageKey
} from '~/utils/credentialVisualDesign'
import type { VisualCredentialDesign } from '~/utils/credentialVisualDesign'

/**
 * Guarda SOLO preferencias visuales en este dispositivo; no se sincroniza con Vercel ni con Oracle.
 * La fotografía, el QR y la identidad siempre se consultan al backend existente.
 */
export function useCredentialVisualDesign() {
  const auth = useAuthStore()
  const design = ref<VisualCredentialDesign>(defaultVisualCredentialDesign())
  const loaded = ref(false)
  const storageAvailable = ref(true)
  let activeKey: string | null = null
  let saveTimer: ReturnType<typeof setTimeout> | null = null

  function cancelPending(): void {
    if (saveTimer !== null) clearTimeout(saveTimer)
    saveTimer = null
  }
  function saveNow(): void {
    cancelPending()
    if (!import.meta.client || !loaded.value || !activeKey) return
    try {
      // El payload está acotado a un tema y 12 stickers: nunca se almacena imagen ni token.
      window.localStorage.setItem(activeKey, JSON.stringify(normalizeVisualCredentialDesign(design.value)))
      storageAvailable.value = true
    }
    catch { storageAvailable.value = false }
  }
  function hydrate(): void {
    if (!import.meta.client) return
    // Descargar el diseño de la cuenta anterior antes de cambiar de identificador.
    saveNow()
    loaded.value = false
    activeKey = visualCredentialStorageKey(auth.buyerId)
    design.value = defaultVisualCredentialDesign()
    if (!activeKey) return
    try {
      const stored = window.localStorage.getItem(activeKey)
      if (stored) design.value = normalizeVisualCredentialDesign(JSON.parse(stored))
      storageAvailable.value = true
    }
    catch { storageAvailable.value = false }
    loaded.value = true
  }
  function setDesign(value: VisualCredentialDesign): void {
    design.value = normalizeVisualCredentialDesign(value)
  }
  function resetDesign(): void {
    setDesign(defaultVisualCredentialDesign())
    saveNow()
  }
  function onStorage(e: StorageEvent): void {
    if (!activeKey || e.key !== activeKey || !loaded.value) return
    cancelPending()
    try {
      design.value = e.newValue ? normalizeVisualCredentialDesign(JSON.parse(e.newValue)) : defaultVisualCredentialDesign()
    }
    catch { /* Un dato externo inválido nunca debe impedir usar el editor. */ }
  }
  watch(design, () => {
    if (!import.meta.client || !loaded.value || !activeKey) return
    cancelPending()
    saveTimer = setTimeout(saveNow, 300)
  }, { deep: true })
  watch(() => auth.buyerId, () => hydrate())
  onMounted(() => {
    hydrate()
    window.addEventListener('storage', onStorage)
  })
  onBeforeUnmount(() => {
    saveNow()
    if (import.meta.client) window.removeEventListener('storage', onStorage)
  })
  return { design, loaded, storageAvailable, setDesign, resetDesign, saveNow }
}
