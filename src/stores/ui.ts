import { computed, reactive, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import type { CalendarFilters, CalendarViewMode, DateRange, ISODate, ShiftTypeCode, ThemeMode } from '@/types'
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  formatMonthTitle,
  formatRangeTitle,
  startOfMonth,
  startOfWeek,
  todayISO,
} from '@/utils/date'
import { nowISO } from '@/utils/id'
import { loadUiPreferences, saveUiPreferences, type UiPreferences } from '@/services/ui-storage'

function createDefaultFilters(): CalendarFilters {
  return {
    employeeIds: [],
    departments: [],
    shiftTypes: [],
    onlyWorkDays: false,
    showInactive: false,
  }
}

/**
 * Стор интерфейса: режим просмотра, навигация по датам, фильтры, тема.
 * Доменных данных не хранит — только состояние рабочего места.
 */
export const useUiStore = defineStore('ui', () => {
  const saved = loadUiPreferences() ?? {}

  const viewMode = ref<CalendarViewMode>(saved.viewMode ?? 'month')
  const anchorDate = ref<ISODate>(saved.anchorDate ?? todayISO())
  const theme = ref<ThemeMode>(saved.theme ?? 'system')
  const weekStartsOn = ref<1 | 7>(saved.weekStartsOn === 7 ? 7 : 1)
  const showWeekNumbers = ref(saved.showWeekNumbers !== false)
  const highlightHolidays = ref(saved.highlightHolidays !== false)
  const defaultShiftHours = ref(12)
  /** Дата создания набора данных — попадает в метаданные при сохранении. */
  const dataCreatedAt = ref(nowISO())
  const filters = reactive<CalendarFilters>({ ...createDefaultFilters(), ...(saved.filters ?? {}) })
  const sidebarCollapsed = ref(saved.sidebarCollapsed ?? false)
  const mobileNavOpen = ref(false)
  /** Дата, открытая в панели деталей дня. */
  const selectedDate = ref<ISODate | null>(null)

  /** Текущий отображаемый период. */
  const periodRange = computed<DateRange>(() => {
    if (viewMode.value === 'week') {
      return {
        from: startOfWeek(anchorDate.value, weekStartsOn.value),
        to: endOfWeek(anchorDate.value, weekStartsOn.value),
      }
    }
    return { from: startOfMonth(anchorDate.value), to: endOfMonth(anchorDate.value) }
  })

  /** Заголовок периода для панели инструментов. */
  const periodTitle = computed(() => {
    if (viewMode.value === 'week') {
      return formatRangeTitle(periodRange.value.from, periodRange.value.to)
    }
    return formatMonthTitle(anchorDate.value)
  })

  /** Сколько фильтров активно (для бейджа). */
  const activeFiltersCount = computed(() => {
    let count = 0
    if (filters.employeeIds.length > 0) count += 1
    if (filters.departments.length > 0) count += 1
    if (filters.shiftTypes.length > 0) count += 1
    if (filters.onlyWorkDays) count += 1
    if (filters.showInactive) count += 1
    return count
  })

  /* ------------------------------ навигация ------------------------------- */

  function setAnchor(date: ISODate): void {
    anchorDate.value = date
  }

  function goToday(): void {
    anchorDate.value = todayISO()
  }

  function next(): void {
    anchorDate.value =
      viewMode.value === 'week' ? addDays(anchorDate.value, 7) : addMonths(anchorDate.value, 1)
  }

  function previous(): void {
    anchorDate.value =
      viewMode.value === 'week' ? addDays(anchorDate.value, -7) : addMonths(anchorDate.value, -1)
  }

  function setViewMode(mode: CalendarViewMode): void {
    viewMode.value = mode
  }

  function setTheme(next: ThemeMode): void {
    theme.value = next
  }

  function toggleSidebar(): void {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  function toggleMobileNav(force?: boolean): void {
    mobileNavOpen.value = force ?? !mobileNavOpen.value
  }

  /* ------------------------------ переопределения ------------------------- */

  function openDay(date: ISODate): void {
    selectedDate.value = date
  }

  function closeDay(): void {
    selectedDate.value = null
  }

  /* -------------------------------- фильтры ------------------------------- */

  function toggleEmployee(employeeId: string): void {
    const set = new Set(filters.employeeIds)
    if (set.has(employeeId)) set.delete(employeeId)
    else set.add(employeeId)
    filters.employeeIds = [...set]
  }

  function setEmployees(ids: string[]): void {
    filters.employeeIds = [...ids]
  }

  function toggleDepartment(department: string): void {
    const set = new Set(filters.departments)
    if (set.has(department)) set.delete(department)
    else set.add(department)
    filters.departments = [...set]
  }

  function toggleShiftType(code: ShiftTypeCode): void {
    const set = new Set(filters.shiftTypes)
    if (set.has(code)) set.delete(code)
    else set.add(code)
    filters.shiftTypes = [...set]
  }

  function setOnlyWorkDays(value: boolean): void {
    filters.onlyWorkDays = value
  }

  /** Снимает фильтры по типам смен (используется в панели «Детали дня»). */
  function clearShiftFilters(): void {
    filters.shiftTypes = []
    filters.onlyWorkDays = false
  }

  function setShowInactive(value: boolean): void {
    filters.showInactive = value
  }

  function resetFilters(): void {
    Object.assign(filters, createDefaultFilters())
  }

  /* --------------------- сохранение настроек интерфейса ------------------- */

  function collectPreferences(): UiPreferences {
    return {
      theme: theme.value,
      viewMode: viewMode.value,
      weekStartsOn: weekStartsOn.value,
      showWeekNumbers: showWeekNumbers.value,
      highlightHolidays: highlightHolidays.value,
      sidebarCollapsed: sidebarCollapsed.value,
      filters: { ...filters, employeeIds: [...filters.employeeIds], departments: [...filters.departments], shiftTypes: [...filters.shiftTypes] },
      anchorDate: anchorDate.value,
    }
  }

  watch(
    () => JSON.stringify(collectPreferences()),
    () => {
      saveUiPreferences(collectPreferences())
    },
  )

  return {
    viewMode,
    anchorDate,
    theme,
    weekStartsOn,
    showWeekNumbers,
    highlightHolidays,
    defaultShiftHours,
    dataCreatedAt,
    filters,
    sidebarCollapsed,
    mobileNavOpen,
    selectedDate,
    periodRange,
    periodTitle,
    activeFiltersCount,
    setAnchor,
    goToday,
    next,
    previous,
    setViewMode,
    setTheme,
    toggleSidebar,
    toggleMobileNav,
    openDay,
    closeDay,
    toggleEmployee,
    setEmployees,
    toggleDepartment,
    toggleShiftType,
    setOnlyWorkDays,
    clearShiftFilters,
    setShowInactive,
    resetFilters,
    collectPreferences,
  }
})
