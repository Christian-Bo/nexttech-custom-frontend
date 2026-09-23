/**
 * Protege páginas privadas. Uso en la página:
 *   definePageMeta({ middleware: 'auth' })
 *
 * Si no hay sesión válida, manda al login y recuerda a dónde iba.
 */
export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuthStore()

  if (!auth.isAuthenticated) {
    return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
  }
})