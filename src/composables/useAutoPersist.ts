import { onBeforeUnmount, ref } from 'vue'
import { getActivePinia, type Pinia } from 'pinia'
import { persistNow } from '@/services/persistence'
import { useEmployeesStore } from '@/stores/employees'
import { useScheduleStore } from '@/stores/schedule'
import { useTemplatesStore } from '@/stores/templates'
import { useUiStore } from '@/stores/ui'

/**
 * Автосохранение данных.
 *
 * Сторы не пишут в хранилище сами: composable подписывается на их изменения
 * и сохраняет весь набор данных с небольшой задержкой (debounce),
 * чтобы не трогать дисковое хранилище на каждое нажатие клавиши.
 *
 * На Android запись идёт в SharedPreferences, поэтому дополнительно сохраняем
 * данные, когда приложение уходит в фон (событие visibilitychange) —
 * система может закрыть WebView в любой момент.
 */
export function useAutoPersist(delay = 400) {
  const pinia = getActivePinia() as Pinia | undefined
  const lastSavedAt = ref<string | null>(null)
  const error = ref<string | null>(null)
  let timer: number | undefined
  let pending = false

  async function saveNow(): Promise<void> {
    if (timer !== undefined) {
      window.clearTimeout(timer)
      timer = undefined
    }
    // Не допускаем параллельных записей: на устройстве они идут через мост.
    if (pending) return
    pending = true
    try {
      const result = await persistNow(pinia)
      if (result.ok) {
        lastSavedAt.value = new Date().toISOString()
        error.value = null
      } else {
        error.value = result.error ?? 'Ошибка сохранения данных'
      }
    } finally {
      pending = false
    }
  }

  function schedule(): void {
    if (timer !== undefined) window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      void saveNow()
    }, delay)
  }

  const stores = [
    useTemplatesStore(pinia),
    useEmployeesStore(pinia),
    useScheduleStore(pinia),
    useUiStore(pinia),
  ]

  const stopHandles = stores.map((store) =>
    store.$subscribe(() => schedule(), { detached: true, flush: 'post' }),
  )

  const handleBeforeUnload = (): void => {
    void saveNow()
  }

  /** Уход в фон (сворачивание приложения на телефоне) — сохраняем немедленно. */
  const handleVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') void saveNow()
  }

  window.addEventListener('beforeunload', handleBeforeUnload)
  document.addEventListener('visibilitychange', handleVisibilityChange)

  onBeforeUnmount(() => {
    stopHandles.forEach((stop) => stop())
    window.removeEventListener('beforeunload', handleBeforeUnload)
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    if (timer !== undefined) window.clearTimeout(timer)
  })

  return { saveNow, lastSavedAt, error }
}
