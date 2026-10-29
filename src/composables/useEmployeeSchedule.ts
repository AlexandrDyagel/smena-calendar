import { computed, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'
import type { CalendarCell, EmployeeTemplateAssignment, ISODate, ShiftTypeCode } from '@/types'
import { addMonths, endOfMonth, monthNameRu, startOfMonth, todayISO } from '@/utils/date'
import { countByType, sumHours } from '@/utils/schedule'
import { useEmployeesStore } from '@/stores/employees'
import { useScheduleStore } from '@/stores/schedule'

/**
 * Индивидуальный календарь работника: назначения, переопределения и почасовая сводка.
 * Используется на экране работников и в карточке сотрудника.
 *
 * Первый аргумент принимает значение, ref или геттер — именно геттер (`() => props.employeeId`)
 * нужен при переключении между сотрудниками, иначе composable запомнит идентификатор
 * первого выбранного работника и календарь перестанет обновляться.
 */
export function useEmployeeSchedule(employeeId: MaybeRefOrGetter<string | null | undefined>) {
  const employeesStore = useEmployeesStore()
  const scheduleStore = useScheduleStore()

  const monthAnchor = ref<ISODate>(todayISO())

  const employee = computed(() => employeesStore.getById(toValue(employeeId) ?? undefined))

  /** Действующее назначение на сегодня. */
  const activeAssignment = computed<EmployeeTemplateAssignment | null>(() =>
    employee.value ? scheduleStore.currentAssignmentFor(employee.value.id, todayISO()) : null,
  )

  /** Назначение, которое начнётся позже (если сейчас графика ещё нет). */
  const upcomingAssignment = computed<EmployeeTemplateAssignment | null>(() =>
    employee.value ? scheduleStore.nextAssignmentFor(employee.value.id, todayISO()) : null,
  )

  /** Есть ли у работника хоть какое-то назначение. */
  const hasAssignments = computed(() =>
    employee.value ? scheduleStore.hasAssignments(employee.value.id) : false,
  )

  /**
   * Ключ набора назначений работника.
   * Нужен, чтобы календарь сам переходил к месяцу начала после назначения шаблона.
   */
  const assignmentsKey = computed(() =>
    employee.value
      ? scheduleStore.assignmentsForEmployee(employee.value.id).map((assignment) => `${assignment.id}:${assignment.startDate}:${assignment.endDate ?? ''}`).join('|')
      : '',
  )

  const monthRange = computed(() => ({
    from: startOfMonth(monthAnchor.value),
    to: endOfMonth(monthAnchor.value),
  }))

  const monthTitle = computed(() => {
    const [year, month] = monthAnchor.value.split('-')
    return `${monthNameRu(Number(month))} ${year}`
  })

  /** История назначений шаблонов. */
  const assignments = computed<EmployeeTemplateAssignment[]>(() =>
    employee.value ? scheduleStore.assignmentsForEmployee(employee.value.id) : [],
  )

  /** Конфликты назначений работника. */
  const conflicts = computed(() =>
    employee.value ? scheduleStore.conflictsForEmployee(employee.value.id) : [],
  )

  /** Переопределения работника. */
  const overrides = computed(() =>
    employee.value ? scheduleStore.overridesForEmployee(employee.value.id) : [],
  )

  /** Дни текущего месяца. */
  const cells = computed<CalendarCell[]>(() =>
    employee.value
      ? scheduleStore.resolveForEmployee(employee.value.id, monthRange.value.from, monthRange.value.to)
      : [],
  )

  /** Сводка по типам смен за месяц. */
  const counts = computed(() => countByType(cells.value))

  /** Часы за месяц. */
  const hours = computed(() => sumHours(cells.value))

  /** Количество ручных изменений в месяце. */
  const manualCount = computed(() => cells.value.filter((cell) => cell.source === 'override').length)

  /** Часы по типам смен. */
  const hoursByType = computed(() => {
    const result: Partial<Record<ShiftTypeCode, number>> = {}
    for (const cell of cells.value) {
      if (!cell.type) continue
      result[cell.type] = (result[cell.type] ?? 0) + (cell.hours || 0)
    }
    return result
  })

  function nextMonth(): void {
    monthAnchor.value = addMonths(monthAnchor.value, 1)
  }

  function previousMonth(): void {
    monthAnchor.value = addMonths(monthAnchor.value, -1)
  }

  function currentMonth(): void {
    monthAnchor.value = todayISO()
  }

  /** Перейти к месяцу, в котором начинается график сотрудника. */
  function showStartMonth(): void {
    const target =
      upcomingAssignment.value?.startDate ?? activeAssignment.value?.startDate ?? todayISO()
    monthAnchor.value = target
  }

  /**
   * При смене работника и после назначения/снятия шаблона открываем тот месяц,
   * где график действительно есть: текущий — если сотрудник уже работает по шаблону,
   * иначе месяц начала ближайшего будущего назначения.
   */
  watch(
    [() => toValue(employeeId), assignmentsKey],
    () => {
      if (!employee.value) return
      monthAnchor.value = activeAssignment.value
        ? todayISO()
        : (upcomingAssignment.value?.startDate ?? todayISO())
    },
    { immediate: true },
  )

  return {
    employee,
    monthAnchor,
    monthRange,
    monthTitle,
    activeAssignment,
    upcomingAssignment,
    hasAssignments,
    assignments,
    conflicts,
    overrides,
    cells,
    counts,
    hours,
    hoursByType,
    manualCount,
    nextMonth,
    previousMonth,
    currentMonth,
    showStartMonth,
  }
}
