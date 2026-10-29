import { Capacitor } from '@capacitor/core'
import { SplashScreen } from '@capacitor/splash-screen'

/**
 * Заставки приложения.
 *
 * Их две, и они дополняют друг друга:
 * 1. Нативная (Android/iOS) — системная картинка, которая показывается до загрузки WebView;
 * 2. Веб-заставка из index.html — «дышащий» логотип с названием, видна сразу,
 *    ещё до загрузки бандла, и плавно исчезает, когда приложение готово.
 *
 * Нативная заставка не скрывается автоматически (`launchAutoHide: false`),
 * поэтому переход между ними происходит без белой вспышки.
 */

export interface SplashHideOptions {
  /** Пауза перед началом исчезновения: успевает прочитаться «дыхание» логотипа. */
  delayMs?: number
  /** Длительность затухания; должна совпадать с transition в index.html. */
  fadeMs?: number
}

/** Сколько держим заставку после запуска приложения. */
export const SPLASH_HOLD_MS = 700

/** Скорость затухания (совпадает с CSS-переходом в index.html). */
export const SPLASH_FADE_MS = 350

/** Плавно убирает веб-заставку и удаляет её узел из документа. */
export function hideWebSplash(options: SplashHideOptions = {}): void {
  if (typeof document === 'undefined') return

  const { delayMs = SPLASH_HOLD_MS, fadeMs = SPLASH_FADE_MS } = options
  const splash = document.getElementById('app-splash')
  if (!splash) return

  window.setTimeout(() => {
    splash.classList.add('app-splash--hidden')
    window.setTimeout(() => splash.remove(), fadeMs)
  }, delayMs)
}

/**
 * Вызывается после монтирования приложения.
 * Сначала убираем нативную заставку, затем — веб-слой.
 */
export async function hideSplash(options: SplashHideOptions = {}): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await SplashScreen.hide()
    } catch {
      // Заставка могла быть скрыта системой — это не ошибка.
    }
  }
  hideWebSplash(options)
}
