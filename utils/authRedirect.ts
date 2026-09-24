import type { ActorType, InternalRole } from '~/types/auth'
import { ACTOR_TYPES, INTERNAL_ROLES } from '~/types/auth'

/**
 * Pantalla de inicio según la identidad que devolvió el backend (actorType + rol del JWT).
 * Es solo para la experiencia: la autorización real la valida el backend con sus policies (403).
 */
export function homeFor(actorType: ActorType | null, role: InternalRole | null): string {
  if (actorType === ACTOR_TYPES.BUYER) return '/catalogo'
  if (actorType === ACTOR_TYPES.INTERNAL) {
    if (role === INTERNAL_ROLES.ADMIN) return '/admin'
    if (role === INTERNAL_ROLES.SUPERVISOR) return '/panel'
    if (role === INTERNAL_ROLES.DELIVERY_DRIVER) return '/repartidor'
  }
  return '/'
}

/** Solo rutas internas de la app ("/algo"), nunca URLs externas ni "//dominio". */
export function safeRedirect(value: unknown): string | null {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : null
}

/** Rutas que corresponden a cada tipo de acceso, para no mandar a un comprador al panel ni al revés. */
export function redirectFitsActor(path: string, actorType: ActorType | null): boolean {
  const internal = ['/panel', '/admin', '/repartidor'].some(p => path === p || path.startsWith(`${p}/`))
  return actorType === ACTOR_TYPES.INTERNAL ? internal : !internal
}
