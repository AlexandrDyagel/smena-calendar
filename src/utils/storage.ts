/**
 * Низкоуровневый слой работы с localStorage.
 *
 * Здесь нет знаний о доменных моделях: только безопасное чтение/запись JSON,
 * проверка доступности хранилища и оценка занятого объёма.
 * Замена хранилища на IndexedDB или API выполняется в services/local-repository.ts.
 */

/** Ключи, под которыми приложение хранит данные. */
export const STORAGE_KEYS = {
  /** Основной набор данных (шаблоны, работники, назначения, переопределения). */
  data: 'smena-calendar:data',
  /** Пользовательские настройки интерфейса, не участвующие в экспорте данных. */
  ui: 'smena-calendar:ui',
} as const

/** Префикс всех ключей приложения — нужен для очистки и оценки объёма. */
export const STORAGE_PREFIX = 'smena-calendar:'

/** Доступно ли localStorage (приватный режим, отключённые cookies и т.п.). */
export function isStorageAvailable(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false
    const probe = `${STORAGE_PREFIX}__probe__`
    window.localStorage.setItem(probe, '1')
    window.localStorage.removeItem(probe)
    return true
  } catch {
    return false
  }
}

/** Читает JSON по ключу; при любой ошибке возвращает null. */
export function readJSON<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

/** Записывает значение как JSON. Возвращает false при переполнении хранилища. */
export function writeJSON(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

/** Удаляет ключ. */
export function removeKey(key: string): boolean {
  try {
    window.localStorage.removeItem(key)
    return true
  } catch {
    return false
  }
}

/** Все ключи приложения. */
export function listAppKeys(): string[] {
  try {
    return Object.keys(window.localStorage).filter((key) => key.startsWith(STORAGE_PREFIX))
  } catch {
    return []
  }
}

/** Оценка занятого объёма в байтах (приблизительно, по длине строк). */
export function storageUsageBytes(): number {
  try {
    return listAppKeys().reduce((total, key) => {
      const value = window.localStorage.getItem(key) ?? ''
      // UTF-16: одна кодовая единица — два байта
      return total + (key.length + value.length) * 2
    }, 0)
  } catch {
    return 0
  }
}

/** Человекочитаемый размер: «12,4 КБ». */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 Б'
  const units = ['Б', 'КБ', 'МБ', 'ГБ']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** index
  const text = index === 0 ? String(Math.round(value)) : value.toFixed(1).replace('.', ',')
  return `${text} ${units[index]}`
}

/** Полная очистка данных приложения (не затрагивает посторонние ключи). */
export function clearAppStorage(): boolean {
  const keys = listAppKeys()
  try {
    keys.forEach((key) => window.localStorage.removeItem(key))
    return true
  } catch {
    return false
  }
}
