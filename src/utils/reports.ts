import type {
  CalendarCell,
  DateRange,
  Employee,
  ReportByTypeRow,
  ReportResult,
  ReportRow,
  ReportTotals,
  ShiftTypeCode,
} from '@/types'
import { SHIFT_TYPE_LIST, getShiftMeta } from '@/constants/shift-types'
import { fullName } from './employee'
import { rangeLength } from './date'

/** Входные данные для построения отчёта. */
export interface BuildReportInput {
  /** Вычисленные дни за период (включая переопределения). */
  cells: CalendarCell[]
  /** Работники, по которым строится отчёт. */
  employees: Employee[]
  /** Период отчёта. */
  period: DateRange
}

function emptyRow(employee: Employee, daysTotal: number): ReportRow {
  return {
    employeeId: employee.id,
    employeeName: fullName(employee),
    department: employee.department ?? '',
    position: employee.position ?? '',
    color: employee.color,
    active: employee.active,
    workShifts: 0,
    dayShifts: 0,
    nightShifts: 0,
    fullShifts: 0,
    customShifts: 0,
    offDays: 0,
    vacationDays: 0,
    sickDays: 0,
    hoursTotal: 0,
    hoursByType: {},
    manualOverrides: 0,
    unassignedDays: 0,
    daysTotal,
  }
}

/** Пустой отчёт (например, когда период некорректен или нет работников). */
export function emptyReport(period: DateRange): ReportResult {
  return {
    period,
    days: rangeLength(period.from, period.to),
    rows: [],
    byType: [],
    totals: {
      workShifts: 0,
      offDays: 0,
      vacationDays: 0,
      sickDays: 0,
      hoursTotal: 0,
      manualOverrides: 0,
    },
  }
}

/**
 * Строит сводный отчёт по работникам за период.
 * Учитывает ручные переопределения (они приходят уже применёнными в ячейках).
 */
export function buildReport(input: BuildReportInput): ReportResult {
  const { cells, employees, period } = input
  const daysTotal = rangeLength(period.from, period.to)
  if (employees.length === 0) return emptyReport(period)

  const rowsById = new Map<string, ReportRow>()
  for (const employee of employees) {
    rowsById.set(employee.id, emptyRow(employee, daysTotal))
  }

  for (const cell of cells) {
    const row = rowsById.get(cell.employeeId)
    if (!row) continue

    row.hoursTotal += Number.isFinite(cell.hours) ? cell.hours : 0

    if (cell.source === 'override') row.manualOverrides += 1
    if (cell.source === 'none' || cell.source === 'missing-template') row.unassignedDays += 1

    if (!cell.type) continue
    const meta = getShiftMeta(cell.type)

    row.hoursByType[cell.type] = (row.hoursByType[cell.type] ?? 0) + (cell.hours || 0)

    switch (cell.type) {
      case 'DAY':
        row.dayShifts += 1
        row.workShifts += 1
        break
      case 'NIGHT':
        row.nightShifts += 1
        row.workShifts += 1
        break
      case 'FULL':
        row.fullShifts += 1
        row.workShifts += 1
        break
      case 'CUSTOM':
        row.customShifts += 1
        row.workShifts += 1
        break
      case 'OFF':
        row.offDays += 1
        break
      case 'VACATION':
        row.vacationDays += 1
        break
      case 'SICK':
        row.sickDays += 1
        break
      default:
        if (meta.isWork) row.workShifts += 1
        break
    }
  }

  const rows = [...rowsById.values()].sort((a, b) => a.employeeName.localeCompare(b.employeeName, 'ru'))

  // Разрез «сотрудник × тип смены» — для второй таблицы отчёта.
  const byType: ReportByTypeRow[] = []
  for (const row of rows) {
    for (const meta of SHIFT_TYPE_LIST) {
      const count = countForType(row, meta.code)
      if (count === 0) continue
      byType.push({
        employeeId: row.employeeId,
        employeeName: row.employeeName,
        type: meta.code,
        label: meta.label,
        color: meta.color,
        count,
        hours: row.hoursByType[meta.code] ?? 0,
      })
    }
  }

  const totals = rows.reduce<ReportTotals>(
    (acc, row) => ({
      workShifts: acc.workShifts + row.workShifts,
      offDays: acc.offDays + row.offDays,
      vacationDays: acc.vacationDays + row.vacationDays,
      sickDays: acc.sickDays + row.sickDays,
      hoursTotal: Math.round((acc.hoursTotal + row.hoursTotal) * 100) / 100,
      manualOverrides: acc.manualOverrides + row.manualOverrides,
    }),
    { workShifts: 0, offDays: 0, vacationDays: 0, sickDays: 0, hoursTotal: 0, manualOverrides: 0 },
  )

  return { period, days: daysTotal, rows, byType, totals }
}

/** Количество дней конкретного типа в строке отчёта. */
export function countForType(row: ReportRow, type: ShiftTypeCode): number {
  switch (type) {
    case 'DAY':
      return row.dayShifts
    case 'NIGHT':
      return row.nightShifts
    case 'FULL':
      return row.fullShifts
    case 'CUSTOM':
      return row.customShifts
    case 'OFF':
      return row.offDays
    case 'VACATION':
      return row.vacationDays
    case 'SICK':
      return row.sickDays
    default:
      return 0
  }
}
