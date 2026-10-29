import type { AppData, AppSettings } from '@/types'
import { nowISO } from '@/utils/id'

/** Имя приложения (используется в экспорте и заголовках). */
export const APP_NAME = 'smena-calendar'
export const APP_TITLE = 'Календарь сменных графиков'
export const APP_VERSION = '1.0.0'

/**
 * Версия схемы данных.
 * При изменении структуры: увеличьте число и добавьте шаг в MIGRATIONS.
 */
export const SCHEMA_VERSION = 1

/** Настройки по умолчанию. */
export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  weekStartsOn: 1,
  showWeekNumbers: true,
  highlightHolidays: true,
  defaultShiftHours: 12,
}

/** Полностью пустой набор данных. */
export function createEmptyAppData(): AppData {
  const timestamp = nowISO()
  return {
    version: SCHEMA_VERSION,
    templates: [],
    employees: [],
    assignments: [],
    overrides: [],
    settings: { ...DEFAULT_SETTINGS },
    meta: { app: APP_NAME, createdAt: timestamp, updatedAt: timestamp },
  }
}

/** Шаг миграции с одной версии схемы на следующую. */
interface Migration {
  /** Версия, НА которую переводит шаг. */
  to: number
  description: string
  migrate: (data: Record<string, unknown>) => Record<string, unknown>
}

/**
 * Реестр миграций. Пока схема версии 1 — реальных шагов нет,
 * но механизм готов: добавьте объект { to: 2, ... } и старые данные обновятся сами.
 */
const MIGRATIONS: Migration[] = [
  {
    to: 1,
    description: 'Базовая схема: шаблоны, работники, назначения, переопределения, настройки',
    migrate: (data) => {
      const result = { ...data }
      if (!Array.isArray(result.templates)) result.templates = []
      if (!Array.isArray(result.employees)) result.employees = []
      if (!Array.isArray(result.assignments)) result.assignments = []
      if (!Array.isArray(result.overrides)) result.overrides = []
      if (typeof result.settings !== 'object' || result.settings === null) {
        result.settings = { ...DEFAULT_SETTINGS }
      }
      if (typeof result.meta !== 'object' || result.meta === null) {
        result.meta = { app: APP_NAME, createdAt: nowISO(), updatedAt: nowISO() }
      }
      return result
    },
  },
]

/** Результат миграции. */
export interface MigrationResult {
  data: AppData
  warnings: string[]
  /** Версия, с которой пришлось мигрировать (null — данные уже актуальны). */
  migratedFrom: number | null
}

function toRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

/**
 * Приводит произвольный объект (из localStorage или файла импорта) к текущей версии схемы.
 * Функция не бросает исключений: некорректные данные превращаются в пустой набор + предупреждения.
 */
export function migrateAppData(raw: unknown, options: { sanitize?: (value: unknown) => { data: AppData; warnings: string[] } } = {}): MigrationResult {
  const warnings: string[] = []
  const record = toRecord(raw)

  const versionValue = Number(record.version)
  const incomingVersion = Number.isFinite(versionValue) && versionValue > 0 ? Math.floor(versionValue) : 0

  let working = { ...record }
  let migratedFrom: number | null = null

  if (incomingVersion < SCHEMA_VERSION) {
    migratedFrom = incomingVersion
    const steps = MIGRATIONS.filter((step) => step.to > incomingVersion).sort((a, b) => a.to - b.to)
    for (const step of steps) {
      try {
        working = step.migrate(working)
        warnings.push(`Выполнена миграция схемы: ${step.description}`)
      } catch {
        warnings.push(`Не удалось выполнить миграцию «${step.description}», данные загружены частично`)
      }
    }
  } else if (incomingVersion > SCHEMA_VERSION) {
    warnings.push(
      `Файл создан более новой версией приложения (схема ${incomingVersion}). Неизвестные поля будут сохранены, но могут не отображаться.`,
    )
  }

  working.version = SCHEMA_VERSION

  const fallbackSettings: AppSettings = {
    ...DEFAULT_SETTINGS,
    ...(toRecord(working.settings) as Partial<AppSettings>),
  }

  const base: AppData = {
    version: SCHEMA_VERSION,
    templates: Array.isArray(working.templates) ? (working.templates as AppData['templates']) : [],
    employees: Array.isArray(working.employees) ? (working.employees as AppData['employees']) : [],
    assignments: Array.isArray(working.assignments) ? (working.assignments as AppData['assignments']) : [],
    overrides: Array.isArray(working.overrides) ? (working.overrides as AppData['overrides']) : [],
    settings: fallbackSettings,
    meta: {
      app: String(toRecord(working.meta).app ?? APP_NAME),
      createdAt: String(toRecord(working.meta).createdAt ?? nowISO()),
      updatedAt: nowISO(),
    },
  }

  if (options.sanitize) {
    const sanitized = options.sanitize(base)
    return { data: sanitized.data, warnings: [...warnings, ...sanitized.warnings], migratedFrom }
  }

  return { data: base, warnings, migratedFrom }
}
