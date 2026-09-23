import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { AddCartItemRequest, Cart } from '~/features/cart/types/cart'
import { useCartService } from '~/features/cart/services/cartService'

/**
 * Estado del carrito del comprador (contador del menú, página del carrito y checkout).
 * Con la API real solo se carga si hay sesión de comprador.
 */
export const useCartStore = defineStore('cart', () => {
  const cart = ref<Cart | null>(null)
  const loading = ref(false)

  const items = computed(() => cart.value?.items ?? [])
  const count = computed(() => items.value.reduce((n, i) => n + i.cantidad, 0))
  const total = computed(() => cart.value?.total ?? 0)

  function canUseCart(): boolean {
    return !!useRuntimeConfig().public.useMocks || useAuthStore().isBuyer
  }

  async function load(): Promise<void> {
    if (!canUseCart()) {
      cart.value = null
      return
    }
    loading.value = true
    try {
      cart.value = await useCartService().get()
    }
    finally {
      loading.value = false
    }
  }

  async function add(req: AddCartItemRequest): Promise<void> {
    cart.value = await useCartService().add(req)
  }

  async function setQuantity(id: number, cantidad: number): Promise<void> {
    cart.value = await useCartService().setQuantity(id, cantidad)
  }

  async function remove(id: number): Promise<void> {
    cart.value = await useCartService().remove(id)
  }

  function reset(): void {
    cart.value = null
  }

  return { cart, loading, items, count, total, load, add, setQuantity, remove, reset }
})
