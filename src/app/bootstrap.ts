import type { Pinia } from 'pinia'
import type { AppData } from '@/types'
import { createDemoData } from '@/services/demo-data'
import { applyAppData, clearAllData, hasAnyData, persistNow } from '@/services/persistence'
import { getPlatform, getRepository, isNativeApp, isPersistentStorage } from '@/services/repository'
import { migrateAppData } from '@/services/migrations'
import { sanitizeAppData } from '@/services/validation'

/** Откуда загружены данные при старте приложения. */
export type BootstrapSource = 'storage' | 'demo' | 'empty'

export interface BootstrapResult {
  source: BootstrapSource
  /** Платформа запуска: web, android или ios. */
  platform: 'android' | 'ios' | 'web'
  /** Нативное приложение (APK/IPA), а не браузер. */
  native: boolean
  persistent: boolean
  /** Название хранилища — показывается на экране «Экспорт и импорт». */
  storageTitle: string
  warnings: string[]
}

/**
 * Инициализация данных приложения.
 *
 * 1. Если в хранилище есть сохранённый набор — загружаем его.
 * 2. Если хранилище пустое (первый запуск) — заполняем демонстрационными данными.
 * 3. Если набор сохранён, но пуст (пользователь всё удалил) — оставляем пустым.
 *
 * Функция асинхронная: на Android данные лежат в SharedPreferences
 * и читаются через промисы до первого рендера приложения.
 */
export async function bootstrapData(pinia: Pinia): Promise<BootstrapResult> {
  const repository = getRepository()
  const snapshot = await repository.load()
  const persistent = isPersistentStorage()

  const base = {
    platform: getPlatform(),
    native: isNativeApp(),
    persistent,
    storageTitle: repository.title,
  }

  if (snapshot) {
    const { data, warnings } = migrateAppData(snapshot.data, { sanitize: sanitizeAppData })
    applyAppData(data, pinia)
    return {
      ...base,
      source: hasAnyData(data) ? 'storage' : 'empty',
      warnings,
    }
  }

  const demo = createDemoData()
  applyAppData(demo, pinia)
  const save = await persistNow(pinia)
  const warnings = save.ok
    ? []
    : [save.error ?? 'Не удалось сохранить демонстрационные данные']

  return { ...base, source: 'demo', warnings }
}

/** Заменяет текущие данные демонстрационными (кнопка «Загрузить демо-данные»). */
export async function loadDemoData(pinia: Pinia): Promise<void> {
  applyAppData(createDemoData(), pinia)
  await persistNow(pinia)
}

/** Полностью очищает приложение. */
export async function resetAllData(pinia: Pinia): Promise<void> {
  await clearAllData(pinia)
  await persistNow(pinia)
}

/** Применяет набор данных, полученный из файла импорта, и сохраняет его. */
export async function importAppData(data: AppData, pinia: Pinia): Promise<boolean> {
  applyAppData(data, pinia)
  const result = await persistNow(pinia)
  return result.ok
}
