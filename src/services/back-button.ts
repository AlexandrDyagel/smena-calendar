import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'

/**
 * Обработка системной кнопки «Назад» на Android.
 *
 * Порядок действий:
 * 1. Если открыто модальное окно или боковая панель — закрываем её.
 * 2. Иначе возвращаемся по истории маршрутов.
 * 3. Если истории нет — выходим из приложения.
 *
 * Компоненты регистрируют себя через useBackHandler: последний открытый
 * элемент закрывается первым.
 */

/** Обработчик возвращает true, если он «съел» нажатие. */
type BackHandler = () => boolean

/** Стек зарегистрированных обработчиков: конец массива — верхний слой. */
const handlers: BackHandler[] = []

/** Регистрирует обработчик. Возвращает функцию отмены регистрации. */
export function registerBackHandler(handler: BackHandler): () => void {
  handlers.push(handler)
  return () => {
    const index = handlers.lastIndexOf(handler)
    if (index !== -1) handlers.splice(index, 1)
  }
}

/** Количество зарегистрированных обработчиков (для диагностики и проверок). */
export function backHandlerCount(): number {
  return handlers.length
}

/** Закрывает верхний открытый слой. Возвращает true, если что-то закрыли. */
export function closeTopOverlay(): boolean {
  const handler = handlers[handlers.length - 1]
  if (!handler) return false
  return handler() !== false
}

/** Навигация, которой пользуется обработчик «Назад». */
export interface BackNavigation {
  /** Есть ли куда возвращаться по маршрутам. */
  canGoBack: () => boolean
  /** Вернуться на предыдущий маршрут. */
  goBack: () => void
}

export type BackResult = 'overlay' | 'history' | 'exit'

/**
 * Реакция на нажатие «Назад». Вынесена отдельно от плагина,
 * чтобы её можно было проверить без устройства.
 */
export async function handleBackPress(navigation: BackNavigation): Promise<BackResult> {
  if (closeTopOverlay()) return 'overlay'

  if (navigation.canGoBack()) {
    navigation.goBack()
    return 'history'
  }

  try {
    await App.exitApp()
  } catch {
    // В браузере выход из приложения недоступен — просто сообщаем результат.
  }
  return 'exit'
}

/**
 * Подписывается на системную кнопку «Назад».
 * В браузере ничего не делает. Возвращает функцию отписки.
 */
export function initBackButton(navigation: BackNavigation): () => void {
  if (!Capacitor.isNativePlatform()) return () => {}

  const listener = App.addListener('backButton', ({ canGoBack }) => {
    void handleBackPress({
      canGoBack: () => Boolean(canGoBack) || navigation.canGoBack(),
      goBack: navigation.goBack,
    })
  })

  return () => {
    void listener.then((handle) => handle.remove())
  }
}
