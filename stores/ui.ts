import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

/** Estado global de UI (loading global y navegación). */
export const useUiStore = defineStore('ui', () => {
  const pendingTasks = ref(0)
  const isGlobalLoading = computed(() => pendingTasks.value > 0)

  function startLoading(): void {
    pendingTasks.value++
  }

  function stopLoading(): void {
    pendingTasks.value = Math.max(0, pendingTasks.value - 1)
  }

  /** Ejecuta una tarea mostrando el loading global, y lo apaga aunque falle. */
  async function withLoading<T>(task: () => Promise<T>): Promise<T> {
    startLoading()
    try {
      return await task()
    }
    finally {
      stopLoading()
    }
  }

  const navDrawerOpen = ref(false)

  function setNavDrawer(open?: boolean): void {
    navDrawerOpen.value = open ?? !navDrawerOpen.value
  }

  return {
    isGlobalLoading,
    startLoading,
    stopLoading,
    withLoading,
    navDrawerOpen,
    setNavDrawer
  }
})
