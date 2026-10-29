import type { CalendarFilters, CalendarViewMode, ISODate, ThemeMode } from '@/types'
import { STORAGE_KEYS, readJSON, writeJSON } from '@/utils/storage'

/**
 * Пользовательские настройки интерфейса.
 * Хранятся отдельно от доменных данных: они не попадают в экспорт JSON
 * и нужны только для того, чтобы восстановить рабочее место пользователя.
 */
export interface UiPreferences {
  theme: ThemeMode
  viewMode: CalendarViewMode
  weekStartsOn: 1 | 7
  showWeekNumbers: boolean
  highlightHolidays: boolean
  sidebarCollapsed: boolean
  filters: CalendarFilters
  anchorDate: ISODate | null
}

/** Читает настройки интерфейса (или null, если их ещё нет). */
export function loadUiPreferences(): Partial<UiPreferences> | null {
  return readJSON<Partial<UiPreferences>>(STORAGE_KEYS.ui)
}

/** Сохраняет настройки интерфейса. */
export function saveUiPreferences(preferences: UiPreferences): boolean {
  return writeJSON(STORAGE_KEYS.ui, preferences)
}
