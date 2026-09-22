export interface ConfirmOptions {
  title: string
  message?: string
  confirmText?: string
  cancelText?: string
  /** Acción destructiva: botón en rojo. */
  danger?: boolean
}

interface ConfirmState extends Required<Omit<ConfirmOptions, 'message'>> {
  open: boolean
  message: string
}

// El resolver vive fuera del estado reactivo (las funciones no se serializan en SSR).
let pendingResolve: ((value: boolean) => void) | null = null

/**
 * Diálogo de confirmación basado en promesas:
 *   if (await confirm({ title: '¿Eliminar diseño?', danger: true })) { ... }
 * Renderizado por <ConfirmDialog> (montado una sola vez en el layout).
 */
export function useConfirm() {
  const state = useState<ConfirmState>('nt-confirm', () => ({
    open: false,
    title: '',
    message: '',
    confirmText: 'Confirmar',
    cancelText: 'Cancelar',
    danger: false
  }))

  function confirm(options: ConfirmOptions): Promise<boolean> {
    // Si había uno abierto, se cancela antes de abrir el nuevo.
    pendingResolve?.(false)

    state.value = {
      open: true,
      title: options.title,
      message: options.message ?? '',
      confirmText: options.confirmText ?? 'Confirmar',
      cancelText: options.cancelText ?? 'Cancelar',
      danger: options.danger ?? false
    }

    return new Promise<boolean>((resolve) => {
      pendingResolve = resolve
    })
  }

  function settle(value: boolean): void {
    state.value = { ...state.value, open: false }
    pendingResolve?.(value)
    pendingResolve = null
  }

  return {
    state: readonly(state),
    confirm,
    accept: () => settle(true),
    cancel: () => settle(false)
  }
}
