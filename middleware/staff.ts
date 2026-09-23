import { INTERNAL_ROLES } from '~/types/auth'

/** Solo ADMIN / SUPERVISOR. En modo simulado se permite para la demo. */
export default defineNuxtRouteMiddleware((to) => {
  if (useRuntimeConfig().public.useMocks) return
  const auth = useAuthStore()
  if (!auth.isAuthenticated) return navigateTo({ path: '/interno', query: { redirect: to.fullPath } })
  if (auth.mustChangePassword) return navigateTo('/interno')
  if (!auth.hasRole(INTERNAL_ROLES.ADMIN, INTERNAL_ROLES.SUPERVISOR)) return navigateTo('/')
})
