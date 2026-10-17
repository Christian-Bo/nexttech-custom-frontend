import type { HttpClient } from '~/types/api'
import type { FaceCaptureDto, FaceChallengeDto, FaceEnrollResultDto, FaceVerifyResultDto } from '~/types/auth'
import { useApi } from '~/services/api'

function captureForm(challengeId: string, capture: FaceCaptureDto): FormData {
  const form = new FormData()
  form.append('challengeId', challengeId)
  form.append('neutralImage', capture.neutralImage, 'neutral.jpg')
  form.append('challengeImage', capture.challengeImage, 'challenge.jpg')
  return form
}

/** Convierte la imagen a JPEG real antes de enviarla a la Face API de segmentación. */
async function prepareSegmentImage(image: Blob): Promise<Blob> {
  if (image.type === 'image/jpeg' && image.size <= 5 * 1024 * 1024) return image

  const bitmap = await createImageBitmap(image)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('No se pudo procesar la imagen.')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(bitmap, 0, 0)

    const output = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85))
    if (!output || output.type !== 'image/jpeg') throw new Error('No se pudo preparar la fotografía para segmentación.')
    if (output.size > 5 * 1024 * 1024) throw new Error('La imagen supera el límite de 5 MB para la segmentación.')
    return output
  }
  finally {
    bitmap.close()
  }
}

/** Biometría del comprador autenticado (/api/face, BuyerOnly). */
export function createFaceService(api: HttpClient) {
  return {
    challenge: () =>
      api<FaceChallengeDto>('/api/face/challenge', { method: 'POST' }),

    /** 422 = no pasó prueba de vida/identidad: pedir reto nuevo y repetir. */
    enroll: (challengeId: string, capture: FaceCaptureDto) =>
      api<FaceEnrollResultDto>('/api/face/enroll', { method: 'POST', body: captureForm(challengeId, capture), timeout: 45_000 }),

    /** Nuevo onboarding V4: 2 capturas y liveness durante una misma sesión. */
    completeOnboarding: (challengeId: string, capture: FaceCaptureDto) =>
      api<FaceEnrollResultDto>('/api/onboarding/complete', { method: 'POST', body: captureForm(challengeId, capture), timeout: 60_000 }),

    /** 200 no implica aprobado: usar isFaceVerificationApproved(). 409 = sin enrolamiento. */
    verify: (challengeId: string, capture: FaceCaptureDto) =>
      api<FaceVerifyResultDto>('/api/face/verify', { method: 'POST', body: captureForm(challengeId, capture), timeout: 45_000 }),

    /** Devuelve la imagen segmentada (Blob) usando archivo JPEG válido y consistente. */
    segmentCard: async (image: Blob) => {
      const jpeg = await prepareSegmentImage(image)
      const form = new FormData()
      form.append('image', jpeg, 'photo.jpg')
      return api<Blob>('/api/face/card/segment', { method: 'POST', body: form, responseType: 'blob', timeout: 45_000 })
    }
  }
}

export function isFaceVerificationApproved(result: FaceVerifyResultDto): boolean {
  return result.authenticationPassed === true && result.isLive === true && result.isMatch === true
}

export type FaceService = ReturnType<typeof createFaceService>

export function useFaceService(): FaceService {
  return createFaceService(useApi())
}
