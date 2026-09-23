import { getCurrentScope, onScopeDispose, readonly, ref, shallowRef } from 'vue'

export type CameraFacing = 'user' | 'environment'

export type CameraErrorCode = 'UNSUPPORTED' | 'INSECURE' | 'DENIED' | 'NOT_FOUND' | 'IN_USE' | 'UNKNOWN'

export interface CameraError {
  code: CameraErrorCode
  message: string
}

function toCameraError(error: unknown): CameraError {
  const name = error instanceof DOMException || error instanceof Error ? error.name : ''
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return { code: 'DENIED', message: 'Permiso de cámara denegado. Habilítalo en la configuración del navegador.' }
    case 'NotFoundError':
    case 'OverconstrainedError':
      return { code: 'NOT_FOUND', message: 'No se encontró una cámara disponible.' }
    case 'NotReadableError':
    case 'AbortError':
      return { code: 'IN_USE', message: 'La cámara está siendo usada por otra aplicación.' }
    default:
      return { code: 'UNKNOWN', message: 'No se pudo iniciar la cámara.' }
  }
}

/**
 * Cámara reutilizable (personalización, foto de entrega, QR).
 * Garantiza liberar los tracks al detener o al desmontar el componente.
 */
export function useCamera(initialFacing: CameraFacing = 'user') {
  const stream = shallowRef<MediaStream | null>(null)
  const facing = ref<CameraFacing>(initialFacing)
  const isActive = ref(false)
  const isStarting = ref(false)
  const error = ref<CameraError | null>(null)
  const hasMultipleCameras = ref(false)
  let video: HTMLVideoElement | null = null

  function stop(): void {
    stream.value?.getTracks().forEach(track => track.stop())
    stream.value = null
    if (video) video.srcObject = null
    isActive.value = false
  }

  async function start(target?: HTMLVideoElement | null): Promise<boolean> {
    if (target) video = target
    error.value = null

    if (!import.meta.client || !navigator.mediaDevices?.getUserMedia) {
      error.value = { code: 'UNSUPPORTED', message: 'Tu navegador no permite usar la cámara.' }
      return false
    }
    if (!window.isSecureContext) {
      error.value = { code: 'INSECURE', message: 'La cámara solo funciona en HTTPS o en localhost.' }
      return false
    }

    stop()
    isStarting.value = true
    try {
      stream.value = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facing.value }, width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false
      })
      if (video) {
        video.srcObject = stream.value
        video.muted = true
        video.playsInline = true
        await video.play()
      }
      const devices = await navigator.mediaDevices.enumerateDevices()
      hasMultipleCameras.value = devices.filter(d => d.kind === 'videoinput').length > 1
      isActive.value = true
      return true
    }
    catch (e) {
      stop()
      error.value = toCameraError(e)
      return false
    }
    finally {
      isStarting.value = false
    }
  }

  async function switchCamera(): Promise<void> {
    facing.value = facing.value === 'user' ? 'environment' : 'user'
    if (isActive.value) await start()
  }

  /** Captura el frame actual como Blob JPEG (sin espejo, como lo ve la cámara). */
  async function capture(quality = 0.92): Promise<Blob | null> {
    if (!video || !isActive.value || !video.videoWidth) return null
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality))
  }

  if (getCurrentScope()) onScopeDispose(stop)

  return {
    stream: readonly(stream),
    facing: readonly(facing),
    isActive: readonly(isActive),
    isStarting: readonly(isStarting),
    error: readonly(error),
    hasMultipleCameras: readonly(hasMultipleCameras),
    start,
    stop,
    switchCamera,
    capture
  }
}
