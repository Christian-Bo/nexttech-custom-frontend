import { INTERNAL_ROLES } from '~/types/auth'
import { homeFor } from '~/utils/authRedirect'

/**
 * Solo ADMIN. Es una ayuda de navegación: aunque alguien entre a mano,
 * el backend responde 403 a quien no tenga la policy AdminOnly.
 */
export default defineNuxtRouteMiddleware((to) => {
  if (useRuntimeConfig().public.useMocks) return
  const auth = useAuthStore()
  if (!auth.isAuthenticated || auth.mustChangePassword) return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
  if (!auth.hasRole(INTERNAL_ROLES.ADMIN)) return navigateTo(homeFor(auth.actorType, auth.role))
})
