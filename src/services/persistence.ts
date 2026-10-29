import type { Pinia } from 'pinia'
import type { AppData, AppSettings } from '@/types'
import { nowISO } from '@/utils/id'
import { useEmployeesStore } from '@/stores/employees'
import { useScheduleStore } from '@/stores/schedule'
import { useTemplatesStore } from '@/stores/templates'
import { useUiStore } from '@/stores/ui'
import { APP_NAME, DEFAULT_SETTINGS, SCHEMA_VERSION } from './migrations'
import { getRepository, type SaveResult } from './repository'

/**
 * Мост между Pinia-сторами и слоем хранения.
 * Сторы не знают про localStorage: сериализация и восстановление живут здесь.
 */

/** Собирает полный набор данных из сторов. */
export function collectAppData(pinia?: Pinia): AppData {
  const templatesStore = useTemplatesStore(pinia)
  const employeesStore = useEmployeesStore(pinia)
  const scheduleStore = useScheduleStore(pinia)
  const uiStore = useUiStore(pinia)

  const settings: AppSettings = {
    theme: uiStore.theme,
    weekStartsOn: uiStore.weekStartsOn,
    showWeekNumbers: uiStore.showWeekNumbers,
    highlightHolidays: uiStore.highlightHolidays,
    defaultShiftHours: uiStore.defaultShiftHours || DEFAULT_SETTINGS.defaultShiftHours,
  }

  return {
    version: SCHEMA_VERSION,
    templates: templatesStore.snapshot(),
    employees: employeesStore.snapshot(),
    assignments: scheduleStore.snapshotAssignments(),
    overrides: scheduleStore.snapshotOverrides(),
    settings,
    meta: {
      app: APP_NAME,
      createdAt: uiStore.dataCreatedAt || nowISO(),
      updatedAt: nowISO(),
    },
  }
}

/** Разливает данные по сторам. */
export function applyAppData(data: AppData, pinia?: Pinia): void {
  const templatesStore = useTemplatesStore(pinia)
  const employeesStore = useEmployeesStore(pinia)
  const scheduleStore = useScheduleStore(pinia)
  const uiStore = useUiStore(pinia)

  templatesStore.hydrate(data.templates)
  employeesStore.hydrate(data.employees)
  scheduleStore.hydrate(data.assignments, data.overrides)

  const settings: AppSettings = { ...DEFAULT_SETTINGS, ...data.settings }
  // Тема из сохранённых данных имеет приоритет только если пользователь её не переключал в этой сессии.
  uiStore.theme = settings.theme
  uiStore.weekStartsOn = settings.weekStartsOn === 7 ? 7 : 1
  uiStore.showWeekNumbers = settings.showWeekNumbers
  uiStore.highlightHolidays = settings.highlightHolidays
  uiStore.defaultShiftHours = settings.defaultShiftHours
  uiStore.dataCreatedAt = data.meta.createdAt || nowISO()
}

/** Немедленное сохранение текущего состояния. */
export async function persistNow(pinia?: Pinia): Promise<SaveResult> {
  return getRepository().save(collectAppData(pinia))
}

/** Очищает хранилище и все сторы. */
export async function clearAllData(pinia?: Pinia): Promise<void> {
  await getRepository().clear()
  const templatesStore = useTemplatesStore(pinia)
  const employeesStore = useEmployeesStore(pinia)
  const scheduleStore = useScheduleStore(pinia)
  templatesStore.hydrate([])
  employeesStore.hydrate([])
  scheduleStore.hydrate([], [])
  useUiStore(pinia).closeDay()
}

/** Проверяет, есть ли в наборе данных хоть одна доменная запись. */
export function hasAnyData(data: AppData): boolean {
  return (
    data.templates.length > 0 ||
    data.employees.length > 0 ||
    data.assignments.length > 0 ||
    data.overrides.length > 0
  )
}
