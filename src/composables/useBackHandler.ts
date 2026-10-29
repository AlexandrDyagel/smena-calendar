import { toValue, watchEffect, type MaybeRefOrGetter } from 'vue'
import { registerBackHandler } from '@/services/back-button'

/**
 * Пока компонент открыт, системная кнопка «Назад» закрывает именно его.
 *
 * Пример: `useBackHandler(open, close)` внутри модального окна или боковой панели.
 * Регистрация снимается автоматически при закрытии и при размонтировании,
 * поэтому порядок закрытия всегда соответствует порядку открытия.
 */
export function useBackHandler(isOpen: MaybeRefOrGetter<boolean>, onBack: () => void): void {
  watchEffect((onCleanup) => {
    if (!toValue(isOpen)) return
    onCleanup(
      registerBackHandler(() => {
        onBack()
        return true
      }),
    )
  })
}
