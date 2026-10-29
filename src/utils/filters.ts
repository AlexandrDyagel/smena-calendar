import type { CalendarCell, CalendarFilters, Employee } from '@/types'
import { getShiftMeta } from '@/constants/shift-types'

/**
 * Условия фильтрации календаря.
 *
 * Вынесены в отдельный модуль, чтобы сетка календаря, недельный режим, список
 * и панель «Детали дня» использовали одни и те же правила — иначе фильтр
 * «Только рабочие смены» применяется к сетке, но не к деталям дня.
 */

/** Проходит ли работник через фильтры по активности, сотрудникам и отделам. */
export function matchesEmployeeFilters(employee: Employee, filters: CalendarFilters): boolean {
  if (!filters.showInactive && !employee.active) return false

  if (filters.employeeIds.length > 0 && !filters.employeeIds.includes(employee.id)) {
    return false
  }

  if (filters.departments.length > 0) {
    const department = employee.department ?? ''
    if (!department || !filters.departments.includes(department)) return false
  }

  return true
}

/** Проходит ли вычисленный день через фильтр по типам смен и «только рабочие смены». */
export function matchesShiftFilters(cell: CalendarCell, filters: CalendarFilters): boolean {
  if (filters.shiftTypes.length > 0) {
    if (!cell.type || !filters.shiftTypes.includes(cell.type)) return false
  }

  if (filters.onlyWorkDays) {
    if (!cell.type || !getShiftMeta(cell.type).isWork) return false
  }

  return true
}

/** Активны ли фильтры по типам смен (для подсказок в интерфейсе). */
export function hasShiftFilters(filters: CalendarFilters): boolean {
  return filters.shiftTypes.length > 0 || filters.onlyWorkDays
}

/** Есть ли вообще активные фильтры. */
export function hasAnyFilters(filters: CalendarFilters): boolean {
  return (
    hasShiftFilters(filters) ||
    filters.employeeIds.length > 0 ||
    filters.departments.length > 0 ||
    filters.showInactive
  )
}
