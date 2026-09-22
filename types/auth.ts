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
