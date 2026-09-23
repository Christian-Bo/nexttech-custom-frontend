/**
 * Contratos de autenticación.
 * Fuente: backend NextTech.Application/Authentication + Modules/Auth (verificado 2026-09-22).
 * El API serializa en camelCase.
 */

export const ACTOR_TYPES = {
  BUYER: 'buyer',
  INTERNAL: 'internal'
} as const

export type ActorType = (typeof ACTOR_TYPES)[keyof typeof ACTOR_TYPES]

export const INTERNAL_ROLES = {
  ADMIN: 'ADMIN',
  SUPERVISOR: 'SUPERVISOR',
  DELIVERY_DRIVER: 'REPARTIDOR'
} as const

export type InternalRole = (typeof INTERNAL_ROLES)[keyof typeof INTERNAL_ROLES]

/** Respuesta de /api/auth/login, /qr-login, /face-login y /api/internal/auth/login. */
export interface AccessTokenResultDto {
  accessToken: string
  expiresAtUtc: string
  actorType: ActorType
  mustChangePassword: boolean
}

/** POST /api/auth/login — identifier = correo o nickname. */
export interface LoginRequestDto {
  identifier: string
  password: string
}

/** POST /api/auth/qr-login */
export interface QrLoginRequestDto {
  qrCredential: string
}

/** POST /api/auth/register */
export interface BuyerRegisterRequestDto {
  email: string
  phone: string
  nickname: string
  password: string
  birthDate?: string | null
  notifyByEmail: boolean
  notifyByWhatsApp: boolean
}

/** 201 de POST /api/auth/register */
export interface BuyerRegistrationResultDto {
  buyerId: number
  qrCredential: string
  token: AccessTokenResultDto
}

/** POST /api/internal/auth/login */
export interface InternalLoginRequestDto {
  email: string
  password: string
}

/** Claims del JWT que usa el frontend (solo lectura; la validación real es del backend). */
export interface JwtClaims {
  sub?: string
  exp?: number
  actor_type?: ActorType
  buyer_id?: string
  nickname?: string
  internal_user_id?: string
  role?: InternalRole
  must_change_password?: 'true' | 'false'
}

/** Sesión persistida en cookie. */
export interface AuthSession {
  accessToken: string
  expiresAtUtc: string
  actorType: ActorType
  mustChangePassword: boolean
}

// ---------------------------------------------------------------------------
// Recuperación de contraseña
// ---------------------------------------------------------------------------

/** POST /api/auth/forgot-password */
export interface ForgotPasswordRequestDto {
  email: string
}

/** 200 de forgot-password. Mensaje siempre neutro (no revela si la cuenta existe). */
export interface ForgotPasswordResultDto {
  message: string
  /** Solo en Development con SMTP deshabilitado. */
  developmentToken: { token: string, expiresAt: string } | null
}

/** POST /api/auth/reset-password -> 204 */
export interface ResetPasswordRequestDto {
  token: string
  newPassword: string
}

/** 200 de POST /api/auth/qr/rotate. El QR anterior queda inválido. */
export interface QrRotateResultDto {
  qrCredential: string
}

// ---------------------------------------------------------------------------
// Biometría facial (Face API vía backend)
// ---------------------------------------------------------------------------

/** Reto de prueba de vida. Un reto nuevo por cada intento; expira (~60 s). */
export interface FaceChallengeDto {
  id: string
  /** p. ej. 'TURN_IMAGE_LEFT' */
  action: string
  instruction: string
  expiresAtUtc: string
  expiresInSeconds: number
}

/** Fotos del intento: frontal + cumpliendo el reto. Máx. 5 MB c/u. */
export interface FaceCaptureDto {
  neutralImage: Blob
  challengeImage: Blob
}

/** 200 de POST /api/face/enroll */
export interface FaceEnrollResultDto {
  enrolled: boolean
  templateVersion: string
  model: string
  portraitWidth: number
  portraitHeight: number
  enrolledAtUtc: string
  message: string
}

/**
 * 200 de POST /api/face/verify.
 * OJO: HTTP 200 NO significa aprobado; evaluar authenticationPassed + isLive + isMatch.
 */
export interface FaceVerifyResultDto {
  authenticationPassed: boolean
  decision: string
  isLive: boolean | null
  livenessDecision?: string
  livenessReasonCode?: string
  action?: string
  isMatch: boolean | null
  [key: string]: unknown
}

export const FACE_MAX_IMAGE_BYTES = 5 * 1024 * 1024
