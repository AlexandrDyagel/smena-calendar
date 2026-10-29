import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './app/router'
import { bootstrapData } from './app/bootstrap'
import { hideSplash } from './services/splash'
import './styles/main.css'

/**
 * Точка входа.
 *
 * Порядок важен: сначала Pinia, затем загрузка данных (на Android — асинхронное
 * чтение SharedPreferences), и только потом монтирование приложения,
 * чтобы первый кадр сразу показывал сохранённые данные.
 */
async function start(): Promise<void> {
  const pinia = createPinia()
  const app = createApp(App)

  app.use(pinia)

  let bootstrap
  try {
    bootstrap = await bootstrapData(pinia)
  } catch (error) {
    console.error('[smena-calendar] Ошибка загрузки данных:', error)
    // Приложение всё равно должно запуститься — с пустыми данными.
    bootstrap = await bootstrapData(pinia)
  }

  if (bootstrap.warnings.length > 0) {
    console.warn('[smena-calendar] Замечания при загрузке:', bootstrap.warnings)
  }

  app.use(router)
  app.mount('#app')

  // Убираем нативную и веб-заставку: «дышащий» логотип успевает показаться,
  // а переход к интерфейсу идёт плавным затуханием.
  await hideSplash()

  if (import.meta.env.DEV) {
    console.info(
      `[smena-calendar] Данные: ${bootstrap.source}, платформа: ${bootstrap.platform}, ` +
        `хранилище: ${bootstrap.storageTitle}, постоянное: ${bootstrap.persistent ? 'да' : 'нет'}`,
    )
  }
}

void start()
