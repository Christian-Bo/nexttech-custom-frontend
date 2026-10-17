/** Solo el comprador autenticado puede personalizar y emitir su credencial. */
export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuthStore()
  if (!auth.isBuyer) return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
})
