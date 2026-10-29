import type {
  AssignmentConflict,
  CalendarCell,
  CalendarOverride,
  EmployeeTemplateAssignment,
  ISODate,
  ScheduleTemplate,
  ShiftTypeCode,
  TemplateSegment,
} from '@/types'
import { getShiftMeta } from '@/constants/shift-types'
import { addDays, diffInDays, enumerateDates, isValidISODate, compareISO } from './date'

/**
 * ЯДРО РАСЧЁТА СМЕН.
 *
 * Все функции этого модуля — чистые: они не обращаются к Pinia, DOM и localStorage,
 * а получают данные аргументами. Это делает логику тестируемой и переиспользуемой.
 */

/** Результат разбора даты внутри цикла шаблона. */
export interface TemplateDayResolution {
  segment: TemplateSegment
  /** Индекс сегмента в цикле (с нуля). */
  index: number
  /** Длина цикла в днях. */
  cycleLength: number
  /** Номер прохода цикла; для дат раньше старта может быть отрицательным. */
  cycleIndex: number
  /** Смещение даты от начала применения шаблона в днях. */
  dayOffset: number
}

/** Контекст расчёта: срез состояния приложения, нужный для вычисления дней. */
export interface ResolveContext {
  assignments: EmployeeTemplateAssignment[]
  templates: ScheduleTemplate[]
  overrides: CalendarOverride[]
}

/** Приводит отрицательный остаток к диапазону [0, length). */
function positiveModulo(value: number, length: number): number {
  if (length <= 0) return 0
  return ((value % length) + length) % length
}

/**
 * Определяет позицию даты внутри цикла шаблона.
 * Корректно работает для дат раньше даты начала: используется
 * математический остаток, а не остаток от деления в стиле C.
 */
export function getCyclePosition(
  template: ScheduleTemplate,
  assignmentStart: ISODate,
  date: ISODate,
): number | null {
  const length = template.segments.length
  if (length === 0) return null
  return positiveModulo(diffInDays(assignmentStart, date), length)
}

/** Возвращает сегмент шаблона, попадающий на указанную дату. */
export function resolveTemplateDay(
  template: ScheduleTemplate,
  assignmentStart: ISODate,
  date: ISODate,
): TemplateDayResolution | null {
  const length = template.segments.length
  if (length === 0) return null
  const dayOffset = diffInDays(assignmentStart, date)
  const index = positiveModulo(dayOffset, length)
  const segment = template.segments[index]
  if (!segment) return null
  return {
    segment,
    index,
    cycleLength: length,
    cycleIndex: Math.floor(dayOffset / length),
    dayOffset,
  }
}

/** Разворачивает шаблон в последовательность сегментов для предпросмотра. */
export function previewTemplate(
  template: ScheduleTemplate,
  startDate: ISODate,
  days: number,
): Array<{ date: ISODate; segment: TemplateSegment | null; index: number | null }> {
  return Array.from({ length: Math.max(0, days) }, (_, offset) => {
    const date = addDays(startDate, offset)
    const resolved = resolveTemplateDay(template, startDate, date)
    return {
      date,
      segment: resolved?.segment ?? null,
      index: resolved?.index ?? null,
    }
  })
}

/** Активно ли назначение на указанную дату (границы включительно). */
export function isAssignmentActiveOn(
  assignment: EmployeeTemplateAssignment,
  date: ISODate,
): boolean {
  if (!isValidISODate(assignment.startDate) || !isValidISODate(date)) return false
  if (compareISO(assignment.startDate, date) > 0) return false
  if (assignment.endDate && compareISO(assignment.endDate, date) < 0) return false
  return true
}

/**
 * Выбирает действующее назначение работника на дату.
 *
 * Правило приоритета: если на дату активно несколько назначений,
 * побеждает то, которое началось позже; при равенстве дат — созданное позже.
 * Остальные назначения возвращаются как конфликтующие (для предупреждения в UI).
 */
export function selectAssignment(
  assignments: EmployeeTemplateAssignment[],
  employeeId: string,
  date: ISODate,
): {
  assignment: EmployeeTemplateAssignment | null
  conflicts: EmployeeTemplateAssignment[]
} {
  const active = assignments.filter(
    (item) => item.employeeId === employeeId && isAssignmentActiveOn(item, date),
  )
  if (active.length === 0) return { assignment: null, conflicts: [] }

  const sorted = [...active].sort((a, b) => {
    const byStart = compareISO(a.startDate, b.startDate)
    if (byStart !== 0) return byStart
    const byCreated = a.createdAt.localeCompare(b.createdAt)
    if (byCreated !== 0) return byCreated
    return a.id.localeCompare(b.id)
  })

  return {
    assignment: sorted[sorted.length - 1] ?? null,
    conflicts: sorted.slice(0, -1),
  }
}

/** Находит последнее по времени переопределение дня. */
export function selectOverride(
  overrides: CalendarOverride[],
  employeeId: string,
  date: ISODate,
): CalendarOverride | null {
  const matches = overrides.filter((item) => item.employeeId === employeeId && item.date === date)
  if (matches.length === 0) return null
  return matches.reduce((latest, current) =>
    current.updatedAt.localeCompare(latest.updatedAt) >= 0 ? current : latest,
  )
}

/** Часы для переопределения: явные или из справочника типов. */
export function hoursForOverride(override: CalendarOverride): number {
  if (typeof override.hours === 'number' && Number.isFinite(override.hours)) {
    return override.hours
  }
  return getShiftMeta(override.type).defaultHours
}

/**
 * Главная функция расчёта дня работника.
 *
 * Порядок приоритетов:
 * 1) ручное переопределение дня — всегда побеждает;
 * 2) активное назначение шаблона (из нескольких — последнее начавшееся);
 * 3) отсутствие размеченного дня.
 */
export function resolveEmployeeDay(
  employeeId: string,
  date: ISODate,
  assignments: EmployeeTemplateAssignment[],
  templates: ScheduleTemplate[],
  overrides: CalendarOverride[],
): CalendarCell {
  const base: CalendarCell = {
    employeeId,
    date,
    source: 'none',
    type: null,
    hours: 0,
  }

  if (!isValidISODate(date)) {
    return { ...base, source: 'none', message: 'Некорректная дата' }
  }

  // 1. Переопределение имеет наивысший приоритет.
  const override = selectOverride(overrides, employeeId, date)
  if (override) {
    return {
      ...base,
      source: 'override',
      type: override.type,
      hours: hoursForOverride(override),
      overrideId: override.id,
      reason: override.reason,
      label: undefined,
    }
  }

  // 2. Ищем действующее назначение шаблона.
  const { assignment, conflicts } = selectAssignment(assignments, employeeId, date)
  if (!assignment) {
    return { ...base, source: 'none', message: 'Шаблон не назначен' }
  }

  const template = templates.find((item) => item.id === assignment.templateId)
  if (!template) {
    return {
      ...base,
      source: 'missing-template',
      templateId: assignment.templateId,
      message: 'Шаблон назначения не найден',
    }
  }

  const resolved = resolveTemplateDay(template, assignment.startDate, date)
  if (!resolved) {
    return {
      ...base,
      source: 'template',
      templateId: template.id,
      templateName: template.name,
      hours: 0,
      message: 'В шаблоне нет ни одного сегмента',
    }
  }

  return {
    ...base,
    source: 'template',
    type: resolved.segment.type,
    hours: resolved.segment.hours,
    templateId: template.id,
    templateName: template.name,
    segmentIndex: resolved.index,
    cycleIndex: resolved.cycleIndex,
    cycleLength: resolved.cycleLength,
    label: resolved.segment.label,
    note: resolved.segment.note,
    conflict: conflicts.length > 0,
    conflictAssignmentIds: conflicts.length > 0 ? conflicts.map((item) => item.id) : undefined,
  }
}

/** Вычисляет дни одного работника за диапазон включительно. */
export function resolveEmployeeRange(
  employeeId: string,
  from: ISODate,
  to: ISODate,
  assignments: EmployeeTemplateAssignment[],
  templates: ScheduleTemplate[],
  overrides: CalendarOverride[],
): CalendarCell[] {
  return enumerateDates(from, to).map((date) =>
    resolveEmployeeDay(employeeId, date, assignments, templates, overrides),
  )
}

/** Вычисляет дни нескольких работников за диапазон включительно. */
export function resolveRange(
  employeeIds: string[],
  from: ISODate,
  to: ISODate,
  context: ResolveContext,
): CalendarCell[] {
  const result: CalendarCell[] = []
  for (const employeeId of employeeIds) {
    result.push(
      ...resolveEmployeeRange(
        employeeId,
        from,
        to,
        context.assignments,
        context.templates,
        context.overrides,
      ),
    )
  }
  return result
}

/** Группирует вычисленные дни по дате. */
export function groupCellsByDate(cells: CalendarCell[]): Map<ISODate, CalendarCell[]> {
  const map = new Map<ISODate, CalendarCell[]>()
  for (const cell of cells) {
    const bucket = map.get(cell.date)
    if (bucket) bucket.push(cell)
    else map.set(cell.date, [cell])
  }
  return map
}

/** Группирует вычисленные дни по паре «работник + дата». */
export function groupCellsByEmployeeDate(cells: CalendarCell[]): Map<string, CalendarCell> {
  const map = new Map<string, CalendarCell>()
  for (const cell of cells) {
    map.set(`${cell.employeeId}|${cell.date}`, cell)
  }
  return map
}

/** Ищет пересечения назначений (конфликты) по всем работникам. */
export function findAssignmentConflicts(
  assignments: EmployeeTemplateAssignment[],
  range?: { from: ISODate; to: ISODate },
): AssignmentConflict[] {
  const conflicts: AssignmentConflict[] = []
  const byEmployee = new Map<string, EmployeeTemplateAssignment[]>()
  for (const assignment of assignments) {
    const bucket = byEmployee.get(assignment.employeeId)
    if (bucket) bucket.push(assignment)
    else byEmployee.set(assignment.employeeId, [assignment])
  }

  for (const [employeeId, list] of byEmployee) {
    const sorted = [...list].sort((a, b) => compareISO(a.startDate, b.startDate))
    for (let i = 0; i < sorted.length; i += 1) {
      for (let j = i + 1; j < sorted.length; j += 1) {
        const first = sorted[i]!
        const second = sorted[j]!
        const firstEnd = first.endDate ?? null
        const overlaps = firstEnd === null || compareISO(firstEnd, second.startDate) >= 0
        if (!overlaps) continue
        const date = range && compareISO(second.startDate, range.from) < 0 ? range.from : second.startDate
        conflicts.push({
          employeeId,
          assignmentIds: [first.id, second.id],
          startDates: [first.startDate, second.startDate],
          date,
        })
      }
    }
  }
  return conflicts
}

/** Есть ли у работника хотя бы одно назначение, пересекающееся с диапазоном. */
export function assignmentsInRange(
  assignments: EmployeeTemplateAssignment[],
  employeeId: string,
  range: { from: ISODate; to: ISODate },
): EmployeeTemplateAssignment[] {
  return assignments.filter((assignment) => {
    if (assignment.employeeId !== employeeId) return false
    const startsBeforeEnd = compareISO(assignment.startDate, range.to) <= 0
    const endsAfterStart = !assignment.endDate || compareISO(assignment.endDate, range.from) >= 0
    return startsBeforeEnd && endsAfterStart
  })
}

/** Количество дней по каждому типу смены. */
export function countByType(cells: CalendarCell[]): Record<ShiftTypeCode, number> {
  const counters = {
    DAY: 0,
    NIGHT: 0,
    FULL: 0,
    OFF: 0,
    VACATION: 0,
    SICK: 0,
    CUSTOM: 0,
  } satisfies Record<ShiftTypeCode, number>
  for (const cell of cells) {
    if (cell.type) counters[cell.type] += 1
  }
  return counters
}

/** Суммарные часы по списку дней. */
export function sumHours(cells: CalendarCell[]): number {
  return cells.reduce((sum, cell) => sum + (Number.isFinite(cell.hours) ? cell.hours : 0), 0)
}

/** Заполняет пропущенные дни в диапазоне для работника (используется в отчётах). */
export function ensureFullRange(cells: CalendarCell[], employeeId: string, from: ISODate, to: ISODate): CalendarCell[] {
  const existing = new Map(cells.map((cell) => [`${cell.employeeId}|${cell.date}`, cell]))
  const result: CalendarCell[] = []
  for (const date of enumerateDates(from, to)) {
    const key = `${employeeId}|${date}`
    result.push(
      existing.get(key) ?? {
        employeeId,
        date,
        source: 'none',
        type: null,
        hours: 0,
      },
    )
  }
  return result
}
