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

/** Biometría del comprador autenticado (/api/face, BuyerOnly). */
export function createFaceService(api: HttpClient) {
  return {
    challenge: () =>
      api<FaceChallengeDto>('/api/face/challenge', { method: 'POST' }),

    /** 422 = no pasó prueba de vida/identidad: pedir reto nuevo y repetir. */
    enroll: (challengeId: string, capture: FaceCaptureDto) =>
      api<FaceEnrollResultDto>('/api/face/enroll', { method: 'POST', body: captureForm(challengeId, capture), timeout: 45_000 }),

    /** 200 no implica aprobado: usar isFaceVerificationApproved(). 409 = sin enrolamiento. */
    verify: (challengeId: string, capture: FaceCaptureDto) =>
      api<FaceVerifyResultDto>('/api/face/verify', { method: 'POST', body: captureForm(challengeId, capture), timeout: 45_000 }),

    /** Devuelve la imagen segmentada (Blob). */
    segmentCard: (image: Blob) => {
      const form = new FormData()
      form.append('image', image, 'photo.jpg')
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
