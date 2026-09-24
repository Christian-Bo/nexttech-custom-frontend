import { INTERNAL_ROLES } from '~/types/auth'
import { homeFor } from '~/utils/authRedirect'

/** Protege la app del repartidor (rol REPARTIDOR). En modo simulado se permite el acceso para la demo. */
export default defineNuxtRouteMiddleware((to) => {
  if (useRuntimeConfig().public.useMocks) return
  const auth = useAuthStore()
  if (!auth.isAuthenticated || auth.mustChangePassword) return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
  if (!auth.hasRole(INTERNAL_ROLES.DELIVERY_DRIVER)) return navigateTo(homeFor(auth.actorType, auth.role))
})
