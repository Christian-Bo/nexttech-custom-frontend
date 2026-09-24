import { INTERNAL_ROLES } from '~/types/auth'
import { homeFor } from '~/utils/authRedirect'

/** Solo ADMIN / SUPERVISOR (dashboard y producción). En modo simulado se permite para la demo. */
export default defineNuxtRouteMiddleware((to) => {
  if (useRuntimeConfig().public.useMocks) return
  const auth = useAuthStore()
  if (!auth.isAuthenticated || auth.mustChangePassword) return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
  if (!auth.hasRole(INTERNAL_ROLES.ADMIN, INTERNAL_ROLES.SUPERVISOR)) return navigateTo(homeFor(auth.actorType, auth.role))
})
