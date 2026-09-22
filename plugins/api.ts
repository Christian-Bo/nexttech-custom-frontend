import { createHttpClient } from '~/services/api/httpClient'
import { useAuthStore } from '~/stores/auth'

/**
 * Registra el cliente HTTP compartido como `$api`.
 * Uso: `const api = useApi()` (services/api) o `useNuxtApp().$api`.
 */
export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  const auth = useAuthStore()
  const router = useRouter()

  const api = createHttpClient({
    baseURL: config.public.apiBase,
    getToken: () => auth.accessToken,
    onUnauthorized: () => {
      auth.clearSession()

      // Redirige al login solo si la ruta existe (la crea Integrante 4).
      if (import.meta.client && router.hasRoute('login')) {
        const current = router.currentRoute.value
        if (current.name !== 'login') {
          void navigateTo({ name: 'login', query: { redirect: current.fullPath } })
        }
      }
    }
  })

  return { provide: { api } }
})
