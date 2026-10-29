import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Конфигурация Capacitor (Android/iOS).
 *
 * Приложение полностью локальное: сервер не нужен, веб-сборка кладётся внутрь APK
 * (`webDir: 'dist'`). Данные на телефоне хранятся в SharedPreferences —
 * см. PreferencesRepository в src/services/local-repository.ts.
 */
const config: CapacitorConfig = {
  appId: 'ru.smena.calendar',
  appName: 'Календарь смен',
  webDir: 'dist',
  android: {
    // Светлый фон окна — совпадает с фоном приложения, чтобы не было белой вспышки.
    backgroundColor: '#f1f5f9',
    allowMixedContent: false,
    captureInput: false,
    // На Android 15+ система требует режим edge-to-edge: 'auto' оставляет
    // системные отступы, чтобы шапка не уезжала под строку состояния.
    adjustMarginsForEdgeToEdge: 'auto',
  },
  server: {
    // Стабильный origin (https://localhost) нужен для localStorage и Service Worker.
    androidScheme: 'https',
    iosScheme: 'capacitor',
  },
  plugins: {
    /**
     * Нативная заставка не скрывается сама: приложение скрывает её в main.ts,
     * когда данные прочитаны и интерфейс смонтирован. Так между системной
     * картинкой и «дышащей» веб-заставкой нет белой вспышки.
     */
    SplashScreen: {
      launchAutoHide: false,
      launchShowDuration: 0,
      backgroundColor: '#2563EB',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: false,
    },
  },
}

export default config
