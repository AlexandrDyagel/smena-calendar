import { computed } from 'vue'
import type { CalendarCell, Employee, ISODate } from '@/types'
import { getShiftMeta } from '@/constants/shift-types'
import {
  WEEKDAYS_RU_SHORT,
  getHolidayName,
  getMonthGrid,
  getWeekDates,
  isDayOff,
  isToday,
  isWeekend,
} from '@/utils/date'
import { groupCellsByDate, groupCellsByEmployeeDate } from '@/utils/schedule'
import { matchesEmployeeFilters, matchesShiftFilters } from '@/utils/filters'
import { sortEmployees } from '@/utils/employee'
import { useEmployeesStore } from '@/stores/employees'
import { useScheduleStore } from '@/stores/schedule'
import { useTemplatesStore } from '@/stores/templates'
import { useUiStore } from '@/stores/ui'

/** Краткая сводка по одному дню — используется в ячейке и в панели деталей. */
export interface DayStats {
  total: number
  work: number
  off: number
  vacation: number
  sick: number
  hours: number
  unassigned: number
}

/** Метаданные календарного дня. */
export interface DayMeta {
  date: ISODate
  isToday: boolean
  isWeekend: boolean
  isHoliday: boolean
  holidayName: string | null
  isDayOff: boolean
  isCurrentMonth: boolean
}

/**
 * Центральный composable календаря: связывает фильтры интерфейса,
 * работников и расчёт смен в один набор реактивных данных.
 * Логики расчёта здесь нет — только выборка и агрегация.
 */
export function useCalendar() {
  const ui = useUiStore()
  const employeesStore = useEmployeesStore()
  const scheduleStore = useScheduleStore()
  const templatesStore = useTemplatesStore()

  /** Работники, прошедшие фильтры. */
  const visibleEmployees = computed<Employee[]>(() =>
    sortEmployees(
      employeesStore.items.filter((employee) => matchesEmployeeFilters(employee, ui.filters)),
    ),
  )

  const employeeIds = computed(() => visibleEmployees.value.map((employee) => employee.id))

  /** Текущий период (месяц или неделя). */
  const range = computed(() => ui.periodRange)

  /** Все вычисленные дни периода (без фильтра по типу смены). */
  const allCells = computed(() =>
    scheduleStore.resolveRange(employeeIds.value, range.value.from, range.value.to),
  )

  /** Дни, прошедшие фильтр по типу смены / «только рабочие дни». */
  const visibleCells = computed(() =>
    allCells.value.filter((cell) => matchesShiftFilters(cell, ui.filters)),
  )

  const cellsByDate = computed(() => groupCellsByDate(visibleCells.value))
  const cellsByEmployeeDate = computed(() => groupCellsByEmployeeDate(allCells.value))

  /** Заголовки дней недели с учётом настройки первого дня. */
  const weekdayHeaders = computed(() => {
    const base = WEEKDAYS_RU_SHORT
    return ui.weekStartsOn === 7 ? [base[6]!, ...base.slice(0, 6)] : base
  })

  /** Даты, отображаемые в текущем режиме. */
  const gridDates = computed<ISODate[]>(() =>
    ui.viewMode === 'week'
      ? getWeekDates(ui.anchorDate, ui.weekStartsOn)
      : getMonthGrid(ui.anchorDate, ui.weekStartsOn),
  )

  /** Месяц представлен шестью неделями — так сетка не «прыгает» между месяцами. */
  const monthWeeks = computed<ISODate[][]>(() => {
    const dates = gridDates.value
    const weeks: ISODate[][] = []
    for (let index = 0; index < dates.length; index += 7) {
      weeks.push(dates.slice(index, index + 7))
    }
    return weeks
  })

  const currentMonthKey = computed(() => ui.anchorDate.slice(0, 7))

  /** Работники с конфликтом назначений. */
  const employeesInConflict = computed(
    () => new Set(scheduleStore.assignmentConflicts.map((conflict) => conflict.employeeId)),
  )

  /** Есть ли вообще работники, подходящие под фильтры. */
  const hasEmployees = computed(() => visibleEmployees.value.length > 0)

  /** Смены указанной ячейки. */
  function cellsFor(date: ISODate): CalendarCell[] {
    return cellsByDate.value.get(date) ?? []
  }

  /** Состояние дня конкретного работника с учётом фильтров по типам смен. */
  function cellFor(employeeId: string, date: ISODate): CalendarCell | undefined {
    const cell = cellsByEmployeeDate.value.get(`${employeeId}|${date}`)
    if (!cell) return undefined
    return matchesShiftFilters(cell, ui.filters) ? cell : undefined
  }

  /** Сводка по дню. */
  function statsFor(date: ISODate): DayStats {
    const cells = cellsFor(date)
    const stats: DayStats = {
      total: cells.length,
      work: 0,
      off: 0,
      vacation: 0,
      sick: 0,
      hours: 0,
      unassigned: 0,
    }
    for (const cell of cells) {
      stats.hours += cell.hours || 0
      if (!cell.type) {
        stats.unassigned += 1
        continue
      }
      const meta = getShiftMeta(cell.type)
      if (meta.isWork) stats.work += 1
      else if (cell.type === 'VACATION') stats.vacation += 1
      else if (cell.type === 'SICK') stats.sick += 1
      else if (meta.isOff) stats.off += 1
    }
    return stats
  }

  /** Метаданные дня: сегодня, выходной, праздник, текущий месяц. */
  function metaFor(date: ISODate): DayMeta {
    const holiday = getHolidayName(date)
    return {
      date,
      isToday: isToday(date),
      isWeekend: isWeekend(date),
      isHoliday: holiday !== null,
      holidayName: holiday,
      isDayOff: ui.highlightHolidays ? isDayOff(date) : isWeekend(date),
      isCurrentMonth: date.slice(0, 7) === currentMonthKey.value,
    }
  }

  return {
    ui,
    templatesStore,
    visibleEmployees,
    employeeIds,
    range,
    allCells,
    visibleCells,
    cellsByDate,
    cellsByEmployeeDate,
    weekdayHeaders,
    gridDates,
    monthWeeks,
    currentMonthKey,
    employeesInConflict,
    hasEmployees,
    cellsFor,
    cellFor,
    statsFor,
    metaFor,
  }
}
