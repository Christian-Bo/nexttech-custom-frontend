/**
 * Sesión obligatoria en toda la aplicación.
 *
 * Al terminar en `.global.ts`, Nuxt lo ejecuta en CADA ruta sin que haga falta
 * declararlo en `definePageMeta`. Quien no tenga sesión solo puede llegar a las
 * rutas públicas de abajo; cualquier otra lo devuelve al login.
 *
 * Los middleware por página (`auth`, `buyer`, `admin`, `staff`, `repartidor`)
 * siguen vigentes: este resuelve "¿hay sesión?" y aquellos "¿de qué tipo?".
 */

import { homeFor } from '~/utils/authRedirect'

/** Lo único accesible sin haber iniciado sesión. */
const RUTAS_PUBLICAS = [
  '/login',
  '/registro',
  '/restablecer-contrasena'
]

function esPublica(path: string): boolean {
  return RUTAS_PUBLICAS.some(ruta => path === ruta || path.startsWith(`${ruta}/`))
}

export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuthStore()

  // Con sesión abierta, el login y el registro no tienen sentido: a su inicio.
  if (auth.isAuthenticated) {
    if (to.path === '/login' || to.path === '/registro') {
      return navigateTo(homeFor(auth.actorType, auth.role))
    }
    return
  }

  if (esPublica(to.path)) return

  // La portada no se recuerda como destino: ya es el inicio tras entrar.
  return navigateTo(
    to.fullPath === '/'
      ? '/login'
      : { path: '/login', query: { redirect: to.fullPath } }
  )
})
