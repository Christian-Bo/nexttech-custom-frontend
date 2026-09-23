import { INTERNAL_ROLES } from '~/types/auth'

/**
 * Protege la app del repartidor (rol REPARTIDOR).
 * En modo simulado se permite el acceso para la demo.
 */
export default defineNuxtRouteMiddleware((to) => {
  if (useRuntimeConfig().public.useMocks) return
  const auth = useAuthStore()
  if (!auth.isAuthenticated) return navigateTo({ path: '/interno', query: { redirect: to.fullPath } })
  if (auth.mustChangePassword) return navigateTo('/interno')
  if (!auth.hasRole(INTERNAL_ROLES.DELIVERY_DRIVER)) return navigateTo('/')
})
