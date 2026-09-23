import { useAuthService } from '~/services/authService'

/**
 * Obtiene el valor del QR para la credencial con la foto editada.
 * - Recién registrado: usa el QR que devolvió el registro (no invalida nada).
 * - Después: pide uno nuevo con POST /api/auth/qr/rotate (el anterior deja de funcionar).
 * - Modo demo: genera un valor de prueba.
 */
export function useCredentialQr() {
  const useMocks = !!useRuntimeConfig().public.useMocks
  const fromRegistration = useState<string | null>('nt-registro-credencial', () => null)
  const authService = useAuthService()

  /** true si obtener el QR va a invalidar el anterior (hay que avisar al usuario). */
  const willRotate = computed(() => !useMocks && !fromRegistration.value)

  async function obtain(buyerId: number | null): Promise<string> {
    if (useMocks) return `NT-DEMO-${buyerId ?? 0}-${Date.now().toString(36).toUpperCase()}`
    if (fromRegistration.value) {
      const value = fromRegistration.value
      fromRegistration.value = null
      return value
    }
    const result = await authService.rotateQr()
    return result.qrCredential
  }

  return { useMocks, willRotate, obtain }
}
