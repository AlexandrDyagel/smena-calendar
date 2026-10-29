import { computed, onBeforeUnmount, onMounted, ref, watchEffect } from 'vue'
import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'
import type { ThemeMode } from '@/types'
import { useUiStore } from '@/stores/ui'

/** Тема оформления: светлая, тёмная или системная. */
export function useTheme() {
  const ui = useUiStore()
  const systemPrefersDark = ref(false)
  let media: MediaQueryList | null = null

  const isDark = computed(
    () => ui.theme === 'dark' || (ui.theme === 'system' && systemPrefersDark.value),
  )

  function applyToDocument(dark: boolean): void {
    const root = document.documentElement
    root.classList.toggle('dark', dark)
    root.style.colorScheme = dark ? 'dark' : 'light'
  }

  /**
   * Строка состояния на телефоне: светлые или тёмные значки под тему.
   * На Android 15+ фон строки рисует система (edge-to-edge), поэтому
   * setBackgroundColor может быть недоступен — это не ошибка.
   */
  async function applyStatusBar(dark: boolean): Promise<void> {
    if (!Capacitor.isNativePlatform()) return
    try {
      await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light })
      await StatusBar.setBackgroundColor({ color: dark ? '#020617' : '#f1f5f9' })
    } catch {
      /* платформа не поддерживает изменение цвета — значки уже переключены */
    }
  }

  function handleSystemChange(event: MediaQueryListEvent): void {
    systemPrefersDark.value = event.matches
  }

  onMounted(() => {
    if (typeof window.matchMedia !== 'function') return
    media = window.matchMedia('(prefers-color-scheme: dark)')
    systemPrefersDark.value = media.matches
    media.addEventListener('change', handleSystemChange)
  })

  onBeforeUnmount(() => {
    media?.removeEventListener('change', handleSystemChange)
  })

  watchEffect(() => {
    applyToDocument(isDark.value)
    void applyStatusBar(isDark.value)
  })

  function setTheme(theme: ThemeMode): void {
    ui.setTheme(theme)
  }

  function toggle(): void {
    ui.setTheme(isDark.value ? 'light' : 'dark')
  }

  /** Циклическое переключение: светлая → тёмная → системная. */
  function cycle(): void {
    const order: ThemeMode[] = ['light', 'dark', 'system']
    const index = order.indexOf(ui.theme)
    ui.setTheme(order[(index + 1) % order.length] ?? 'system')
  }

  return { theme: computed(() => ui.theme), isDark, setTheme, toggle, cycle }
}
