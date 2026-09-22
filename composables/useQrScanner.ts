import { getCurrentScope, onScopeDispose, readonly, ref } from 'vue'
import type { IScannerControls } from '@zxing/browser'

export interface QrValidationResult {
  ok: boolean
  message?: string
}

export type QrScannerStatus = 'idle' | 'starting' | 'scanning' | 'detected' | 'error'

export interface UseQrScannerOptions {
  /** Ignora el mismo código leído dentro de esta ventana (ms). */
  duplicateWindowMs?: number
}

/**
 * Lector de QR con ZXing (client-only).
 * - anti-duplicado: el mismo texto no se emite dos veces seguidas
 * - se pausa al detectar; `resume()` para seguir leyendo
 * - libera la cámara al detener o desmontar
 */
export function useQrScanner(options: UseQrScannerOptions = {}) {
  const duplicateWindowMs = options.duplicateWindowMs ?? 3000
  const status = ref<QrScannerStatus>('idle')
  const lastResult = ref<string | null>(null)
  const error = ref<string | null>(null)

  let controls: IScannerControls | null = null
  let onDetect: ((text: string) => void) | null = null
  let lastText = ''
  let lastAt = 0

  function stop(): void {
    controls?.stop()
    controls = null
    if (status.value !== 'detected') status.value = 'idle'
  }

  async function start(video: HTMLVideoElement, callback: (text: string) => void): Promise<void> {
    stop()
    onDetect = callback
    error.value = null
    status.value = 'starting'

    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      status.value = 'error'
      error.value = 'La cámara solo funciona en HTTPS o en localhost. Usa el ingreso manual.'
      return
    }

    try {
      const { BrowserQRCodeReader } = await import('@zxing/browser')
      const reader = new BrowserQRCodeReader(undefined, { delayBetweenScanAttempts: 150 })
      controls = await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: 'environment' } }, audio: false },
        video,
        (result) => {
          if (!result || status.value !== 'scanning') return
          const text = result.getText().trim()
          const now = Date.now()
          if (!text || (text === lastText && now - lastAt < duplicateWindowMs)) return
          lastText = text
          lastAt = now
          lastResult.value = text
          status.value = 'detected'
          onDetect?.(text)
        }
      )
      status.value = 'scanning'
    }
    catch (e) {
      stop()
      status.value = 'error'
      const name = e instanceof Error ? e.name : ''
      error.value = name === 'NotAllowedError'
        ? 'Permiso de cámara denegado. Usa el ingreso manual.'
        : 'No se pudo iniciar el lector. Usa el ingreso manual.'
    }
  }

  /** Vuelve a leer tras una detección (p. ej. si la validación falló). */
  function resume(): void {
    if (controls) status.value = 'scanning'
  }

  if (getCurrentScope()) onScopeDispose(stop)

  return {
    status: readonly(status),
    lastResult: readonly(lastResult),
    error: readonly(error),
    start,
    stop,
    resume
  }
}
