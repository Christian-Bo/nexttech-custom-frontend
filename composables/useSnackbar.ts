import type { ApiError } from '~/types/api'
import { isApiError } from '~/services/api/errors'

export type SnackbarType = 'success' | 'error' | 'warning' | 'info'

export interface SnackbarItem {
  id: number
  message: string
  type: SnackbarType
  /** ms; -1 = no se cierra solo. */
  timeout: number
}

const DEFAULT_TIMEOUT: Record<SnackbarType, number> = {
  success: 3500,
  info: 4000,
  warning: 5000,
  error: 6000
}

let nextId = 1

/**
 * Cola global de avisos (snackbars). Se muestran de a uno, en orden.
 * Renderizado por <AppSnackbar> (montado una sola vez en el layout).
 */
export function useSnackbar() {
  const queue = useState<SnackbarItem[]>('nt-snackbar-queue', () => [])

  function show(message: string, type: SnackbarType = 'info', timeout?: number): void {
    queue.value = [...queue.value, { id: nextId++, message, type, timeout: timeout ?? DEFAULT_TIMEOUT[type] }]
  }

  function dismiss(id: number): void {
    queue.value = queue.value.filter(item => item.id !== id)
  }

  return {
    queue: readonly(queue),
    current: computed(() => queue.value[0] ?? null),
    show,
    dismiss,
    success: (message: string) => show(message, 'success'),
    info: (message: string) => show(message, 'info'),
    warning: (message: string) => show(message, 'warning'),
    /** Acepta un ApiError normalizado o un texto. */
    error: (error: ApiError | string) => show(isApiError(error) ? error.message : error, 'error')
  }
}
