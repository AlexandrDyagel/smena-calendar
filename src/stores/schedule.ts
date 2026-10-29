import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type {
  CalendarCell,
  CalendarOverride,
  DateRange,
  EmployeeTemplateAssignment,
  ISODate,
  ShiftTypeCode,
} from '@/types'
import { addDays, compareISO, endOfMonth, isValidISODate, normalizeRange, startOfMonth, todayISO } from '@/utils/date'
import { createId, nowISO } from '@/utils/id'
import { cloneList } from '@/utils/clone'
import { defaultHoursFor, getShiftMeta, normalizeHours } from '@/constants/shift-types'
import {
  findAssignmentConflicts,
  resolveEmployeeDay,
  resolveEmployeeRange,
  resolveRange as resolveRangeUtility,
  selectAssignment,
  selectOverride,
  type ResolveContext,
} from '@/utils/schedule'
import { useTemplatesStore } from './templates'

/** Параметры назначения шаблона. */
export interface AssignTemplatePayload {
  employeeId: string
  templateId: string
  startDate: ISODate
  endDate?: ISODate | null
  comment?: string
}

/** Параметры ручного переопределения дня. */
export interface SetOverridePayload {
  employeeId: string
  date: ISODate
  type: ShiftTypeCode
  hours?: number
  reason?: string
}

/**
 * Стор расписания: назначения шаблонов, ручные переопределения и расчёт смен.
 * Вся математика вынесена в utils/schedule.ts — здесь только состояние и операции над ним.
 */
export const useScheduleStore = defineStore('schedule', () => {
  const assignments = ref<EmployeeTemplateAssignment[]>([])
  const overrides = ref<CalendarOverride[]>([])
  const templatesStore = useTemplatesStore()

  /** Контекст для чистых функций расчёта. */
  const context = computed<ResolveContext>(() => ({
    assignments: assignments.value,
    templates: templatesStore.items,
    overrides: overrides.value,
  }))

  /** Пересечения назначений (предупреждение в интерфейсе). */
  const assignmentConflicts = computed(() => findAssignmentConflicts(assignments.value))

  /** Сколько переопределений всего. */
  const overridesCount = computed(() => overrides.value.length)

  /** Загружает данные из хранилища. */
  function hydrate(nextAssignments: EmployeeTemplateAssignment[], nextOverrides: CalendarOverride[]): void {
    assignments.value = cloneList(nextAssignments)
    overrides.value = cloneList(nextOverrides)
  }

  /** Снимки для сохранения. */
  function snapshotAssignments(): EmployeeTemplateAssignment[] {
    return cloneList(assignments.value)
  }

  function snapshotOverrides(): CalendarOverride[] {
    return cloneList(overrides.value)
  }

  /* ------------------------------ назначения ------------------------------ */

  /** Назначения работника, отсортированные по дате начала. */
  function assignmentsForEmployee(employeeId: string): EmployeeTemplateAssignment[] {
    return assignments.value
      .filter((assignment) => assignment.employeeId === employeeId)
      .sort((a, b) => compareISO(a.startDate, b.startDate))
  }

  /** Сколько работников используют шаблон (для защиты от удаления). */
  function countAssignmentsForTemplate(templateId: string): number {
    return assignments.value.filter((assignment) => assignment.templateId === templateId).length
  }

  /** Идентификаторы работников, использующих шаблон. */
  function employeesUsingTemplate(templateId: string): string[] {
    return [
      ...new Set(
        assignments.value
          .filter((assignment) => assignment.templateId === templateId)
          .map((assignment) => assignment.employeeId),
      ),
    ]
  }

  /**
   * Назначает шаблон работнику с указанной даты.
   *
   * Расписание работника поддерживается непротиворечивым:
   * — назначение с той же датой начала заменяется новым;
   * — предыдущее открытое назначение закрывается днём перед новой датой.
   */
  function assignTemplate(payload: AssignTemplatePayload): EmployeeTemplateAssignment | null {
    const { employeeId, templateId, startDate } = payload
    if (!isValidISODate(startDate)) return null
    if (!templatesStore.getById(templateId)) return null

    const endDate = payload.endDate ?? null
    const timestamp = nowISO()

    const next: EmployeeTemplateAssignment[] = []
    for (const assignment of assignments.value) {
      if (assignment.employeeId !== employeeId) {
        next.push(assignment)
        continue
      }
      // Полное совпадение даты начала — старое назначение заменяется.
      if (assignment.startDate === startDate) continue
      // Незакрытое или перекрывающееся назначение закрываем днём перед новой датой.
      const startsEarlier = compareISO(assignment.startDate, startDate) < 0
      const stillOpen = !assignment.endDate || compareISO(assignment.endDate, startDate) >= 0
      if (startsEarlier && stillOpen) {
        next.push({ ...assignment, endDate: addDays(startDate, -1) })
        continue
      }
      next.push(assignment)
    }

    const created: EmployeeTemplateAssignment = {
      id: createId('asg'),
      employeeId,
      templateId,
      startDate,
      endDate,
      comment: payload.comment?.trim() || undefined,
      createdAt: timestamp,
    }

    assignments.value = [...next, created]
    return created
  }

  /** Изменяет назначение (например, дату окончания). */
  function updateAssignment(
    id: string,
    patch: Partial<Pick<EmployeeTemplateAssignment, 'startDate' | 'endDate' | 'templateId' | 'comment'>>,
  ): EmployeeTemplateAssignment | null {
    const index = assignments.value.findIndex((assignment) => assignment.id === id)
    if (index === -1) return null
    const current = assignments.value[index]!
    const next: EmployeeTemplateAssignment = {
      ...current,
      ...patch,
      endDate: patch.endDate === undefined ? current.endDate : patch.endDate,
    }
    if (!isValidISODate(next.startDate)) return null
    if (next.endDate && compareISO(next.endDate, next.startDate) < 0) {
      // Некорректный период — трактуем как удаление назначения.
      return null
    }
    const copy = [...assignments.value]
    copy[index] = next
    assignments.value = copy
    return next
  }

  /** Удаляет назначение. */
  function removeAssignment(id: string): boolean {
    const exists = assignments.value.some((assignment) => assignment.id === id)
    if (!exists) return false
    assignments.value = assignments.value.filter((assignment) => assignment.id !== id)
    return true
  }

  /** Действующее назначение работника на дату (с учётом приоритетов). */
  function currentAssignmentFor(employeeId: string, date: ISODate): EmployeeTemplateAssignment | null {
    return selectAssignment(assignments.value, employeeId, date).assignment
  }

  /**
   * Ближайшее назначение, которое ещё не началось.
   * Нужно, чтобы отличать «шаблон не назначен» от «шаблон назначен с будущей даты».
   */
  function nextAssignmentFor(employeeId: string, date: ISODate = todayISO()): EmployeeTemplateAssignment | null {
    const upcoming = assignments.value
      .filter(
        (assignment) =>
          assignment.employeeId === employeeId && compareISO(assignment.startDate, date) > 0,
      )
      .sort(
        (a, b) => compareISO(a.startDate, b.startDate) || a.createdAt.localeCompare(b.createdAt),
      )
    return upcoming[0] ?? null
  }

  /** Есть ли у работника хотя бы одно назначение (в прошлом, настоящем или будущем). */
  function hasAssignments(employeeId: string): boolean {
    return assignments.value.some((assignment) => assignment.employeeId === employeeId)
  }

  /** Конфликты конкретного работника. */
  function conflictsForEmployee(employeeId: string) {
    return assignmentConflicts.value.filter((conflict) => conflict.employeeId === employeeId)
  }

  /* --------------------------- переопределения ---------------------------- */

  /** Переопределения на дату. */
  function overridesOn(date: ISODate): CalendarOverride[] {
    return overrides.value.filter((override) => override.date === date)
  }

  /** Переопределения работника. */
  function overridesForEmployee(employeeId: string): CalendarOverride[] {
    return overrides.value
      .filter((override) => override.employeeId === employeeId)
      .sort((a, b) => compareISO(a.date, b.date))
  }

  /** Переопределение конкретного дня либо null. */
  function overrideFor(employeeId: string, date: ISODate): CalendarOverride | null {
    return selectOverride(overrides.value, employeeId, date)
  }

  /**
   * Ставит или обновляет ручное переопределение дня.
   * Если переопределение на эту дату уже есть — оно перезаписывается,
   * чтобы на одну дату не появлялось двух конкурирующих записей.
   */
  function setOverride(payload: SetOverridePayload): CalendarOverride | null {
    const { employeeId, date, type } = payload
    if (!isValidISODate(date)) return null

    const meta = getShiftMeta(type)
    const hours =
      payload.hours === undefined || payload.hours === null
        ? meta.defaultHours
        : normalizeHours(type, payload.hours)

    const timestamp = nowISO()
    const existing = overrides.value.find(
      (override) => override.employeeId === employeeId && override.date === date,
    )

    if (existing) {
      const updated: CalendarOverride = {
        ...existing,
        type,
        hours,
        reason: payload.reason?.trim() || undefined,
        updatedAt: timestamp,
      }
      overrides.value = overrides.value.map((override) =>
        override.id === existing.id ? updated : override,
      )
      return updated
    }

    const created: CalendarOverride = {
      id: createId('ovr'),
      employeeId,
      date,
      type,
      hours,
      reason: payload.reason?.trim() || undefined,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    overrides.value = [...overrides.value, created]
    return created
  }

  /** Убирает переопределение — день снова считается по шаблону. */
  function clearOverride(employeeId: string, date: ISODate): boolean {
    const before = overrides.value.length
    overrides.value = overrides.value.filter(
      (override) => !(override.employeeId === employeeId && override.date === date),
    )
    return overrides.value.length !== before
  }

  /** Удаляет конкретное переопределение по идентификатору. */
  function removeOverride(id: string): boolean {
    const before = overrides.value.length
    overrides.value = overrides.value.filter((override) => override.id !== id)
    return overrides.value.length !== before
  }

  /** Убирает все переопределения работника. */
  function clearOverridesForEmployee(employeeId: string): number {
    const before = overrides.value.length
    overrides.value = overrides.value.filter((override) => override.employeeId !== employeeId)
    return before - overrides.value.length
  }

  /** Удаляет все данные работника (используется при полном удалении). */
  function removeEmployeeData(employeeId: string): void {
    assignments.value = assignments.value.filter((assignment) => assignment.employeeId !== employeeId)
    overrides.value = overrides.value.filter((override) => override.employeeId !== employeeId)
  }

  /** Удаляет все назначения удаляемого шаблона. */
  function removeAssignmentsForTemplate(templateId: string): number {
    const before = assignments.value.length
    assignments.value = assignments.value.filter((assignment) => assignment.templateId !== templateId)
    return before - assignments.value.length
  }

  /* ------------------------------- расчёт --------------------------------- */

  /** Состояние одного дня работника. */
  function resolveDay(employeeId: string, date: ISODate): CalendarCell {
    return resolveEmployeeDay(
      employeeId,
      date,
      context.value.assignments,
      context.value.templates,
      context.value.overrides,
    )
  }

  /** Состояние дней работника за диапазон. */
  function resolveForEmployee(employeeId: string, from: ISODate, to: ISODate): CalendarCell[] {
    return resolveEmployeeRange(
      employeeId,
      from,
      to,
      context.value.assignments,
      context.value.templates,
      context.value.overrides,
    )
  }

  /** Состояние дней нескольких работников за диапазон. */
  function resolveRange(employeeIds: string[], from: ISODate, to: ISODate): CalendarCell[] {
    const range = normalizeRange(from, to)
    return resolveRangeUtility(employeeIds, range.from, range.to, context.value)
  }

  /** Диапазон по умолчанию: текущий месяц. */
  function currentMonthRange(anchor: ISODate = todayISO()): DateRange {
    return { from: startOfMonth(anchor), to: endOfMonth(anchor) }
  }

  /** Часы по типу смены по умолчанию (для форм). */
  function defaultHours(type: ShiftTypeCode): number {
    return defaultHoursFor(type)
  }

  return {
    assignments,
    overrides,
    context,
    assignmentConflicts,
    overridesCount,
    hydrate,
    snapshotAssignments,
    snapshotOverrides,
    assignmentsForEmployee,
    countAssignmentsForTemplate,
    employeesUsingTemplate,
    assignTemplate,
    updateAssignment,
    removeAssignment,
    currentAssignmentFor,
    nextAssignmentFor,
    hasAssignments,
    conflictsForEmployee,
    overridesOn,
    overridesForEmployee,
    overrideFor,
    setOverride,
    clearOverride,
    removeOverride,
    clearOverridesForEmployee,
    removeEmployeeData,
    removeAssignmentsForTemplate,
    resolveDay,
    resolveForEmployee,
    resolveRange,
    currentMonthRange,
    defaultHours,
  }
})
