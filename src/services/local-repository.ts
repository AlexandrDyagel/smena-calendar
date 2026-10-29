import type { AppData, StorageEnvelope } from '@/types'
import { Preferences } from '@capacitor/preferences'
import { STORAGE_KEYS, isStorageAvailable, readJSON, removeKey, writeJSON } from '@/utils/storage'
import { nowISO } from '@/utils/id'
import { SCHEMA_VERSION, migrateAppData } from './migrations'
import { sanitizeAppData } from './validation'

/**
 * Слой репозитория.
 *
 * Компоненты и сторы не знают, где именно лежат данные: они работают с интерфейсом
 * DataRepository. Методы асинхронные, потому что нативное хранилище Android
 * (SharedPreferences через @capacitor/preferences) доступно только через промисы.
 */

/** Снимок данных, возвращаемый репозиторием. */
export interface StorageSnapshot {
  version: number
  savedAt: string
  data: AppData
}

/** Результат сохранения. */
export interface SaveResult {
  ok: boolean
  error?: string
}

/** Контракт хранилища данных. */
export interface DataRepository {
  /** Тип хранилища — для отображения в интерфейсе. */
  readonly kind: 'local' | 'preferences' | 'memory'
  /** Человекочитаемое название хранилища. */
  readonly title: string
  /** Доступно ли хранилище в текущем окружении. */
  isAvailable(): boolean
  /** Читает данные; null — если данных ещё нет. */
  load(): Promise<StorageSnapshot | null>
  /** Сохраняет данные целиком. */
  save(data: AppData): Promise<SaveResult>
  /** Полностью очищает хранилище приложения. */
  clear(): Promise<void>
}

/** Разбирает сохранённый конверт: миграции схемы + проверка записей. */
function parseEnvelope(raw: unknown): StorageSnapshot | null {
  if (typeof raw !== 'object' || raw === null) return null
  const envelope = raw as Partial<StorageEnvelope>
  if (!envelope.data) return null

  const { data, warnings } = migrateAppData(envelope.data, { sanitize: sanitizeAppData })
  if (warnings.length > 0 && import.meta.env.DEV) {
    console.warn('[smena-calendar] Замечания при загрузке данных:', warnings)
  }

  return {
    version: data.version ?? SCHEMA_VERSION,
    savedAt: envelope.savedAt ?? nowISO(),
    data,
  }
}

/** Собирает конверт для записи. */
function buildEnvelope(data: AppData): StorageEnvelope {
  return {
    version: SCHEMA_VERSION,
    savedAt: nowISO(),
    data: { ...data, version: SCHEMA_VERSION },
  }
}

/** Хранилище на базе localStorage — используется в веб-версии. */
export class LocalStorageRepository implements DataRepository {
  readonly kind = 'local' as const
  readonly title = 'localStorage браузера'

  isAvailable(): boolean {
    return isStorageAvailable()
  }

  async load(): Promise<StorageSnapshot | null> {
    return parseEnvelope(readJSON<StorageEnvelope>(STORAGE_KEYS.data))
  }

  async save(data: AppData): Promise<SaveResult> {
    const ok = writeJSON(STORAGE_KEYS.data, buildEnvelope(data))
    return ok
      ? { ok: true }
      : {
          ok: false,
          error:
            'Не удалось сохранить данные: хранилище браузера переполнено или недоступно. Экспортируйте данные в JSON.',
        }
  }

  async clear(): Promise<void> {
    removeKey(STORAGE_KEYS.data)
  }
}

/**
 * Нативное хранилище Android/iOS: SharedPreferences (Android) и UserDefaults (iOS)
 * через плагин @capacitor/preferences.
 *
 * Почему не localStorage: в WebView его может очистить система при нехватке места,
 * а SharedPreferences живёт в приватных данных приложения и доступен только ему.
 */
export class PreferencesRepository implements DataRepository {
  readonly kind = 'preferences' as const
  readonly title = 'нативное хранилище устройства (SharedPreferences)'

  isAvailable(): boolean {
    return true
  }

  async load(): Promise<StorageSnapshot | null> {
    try {
      const { value } = await Preferences.get({ key: STORAGE_KEYS.data })
      if (!value) return null
      return parseEnvelope(JSON.parse(value) as unknown)
    } catch (error) {
      console.error('[smena-calendar] Не удалось прочитать данные устройства:', error)
      return null
    }
  }

  async save(data: AppData): Promise<SaveResult> {
    try {
      await Preferences.set({
        key: STORAGE_KEYS.data,
        value: JSON.stringify(buildEnvelope(data)),
      })
      return { ok: true }
    } catch (error) {
      return {
        ok: false,
        error: `Не удалось сохранить данные на устройстве: ${
          error instanceof Error ? error.message : String(error)
        }. Экспортируйте данные в JSON.`,
      }
    }
  }

  async clear(): Promise<void> {
    try {
      await Preferences.remove({ key: STORAGE_KEYS.data })
    } catch (error) {
      console.error('[smena-calendar] Не удалось очистить хранилище устройства:', error)
    }
  }
}

/**
 * Резервное хранилище в памяти.
 * Используется, когда постоянное хранилище недоступно: приложение продолжает
 * работать, но данные исчезнут после закрытия.
 */
export class MemoryRepository implements DataRepository {
  readonly kind = 'memory' as const
  readonly title = 'память устройства (временно)'

  private snapshot: StorageSnapshot | null = null

  isAvailable(): boolean {
    return true
  }

  async load(): Promise<StorageSnapshot | null> {
    return this.snapshot
  }

  async save(data: AppData): Promise<SaveResult> {
    this.snapshot = { version: SCHEMA_VERSION, savedAt: nowISO(), data }
    return { ok: true }
  }

  async clear(): Promise<void> {
    this.snapshot = null
  }
}
