import type {
  AppData,
  CalendarOverride,
  Employee,
  EmployeeTemplateAssignment,
  ScheduleTemplate,
} from '@/types'
import { createPresetTemplates } from '@/constants/presets'
import { addDays, addMonths, startOfMonth, todayISO } from '@/utils/date'
import { createId, nowISO } from '@/utils/id'
import { COLOR_PALETTE } from '@/utils/color'
import { APP_NAME, DEFAULT_SETTINGS, SCHEMA_VERSION } from './migrations'

/**
 * Демонстрационные данные, которые загружаются при первом запуске.
 * Их можно в любой момент удалить на экране «Данные» и начать с чистого листа.
 */

interface DemoEmployeeSeed {
  firstName: string
  lastName: string
  middleName: string
  position: string
  department: string
  colorIndex: number
  active: boolean
}

/**
 * Отделы демонстрационного набора.
 * Список отделов в приложении формируется из карточек работников,
 * поэтому чтобы изменить набор отделов, достаточно поменять их здесь.
 */
export const DEMO_DEPARTMENTS = {
  dispatch: 'Диспетчерская',
  electricians: 'Электрики',
  locksmiths: 'Слесаря',
} as const

const DEMO_EMPLOYEE_SEEDS: DemoEmployeeSeed[] = [
  {
    firstName: 'Иван',
    lastName: 'Иванов',
    middleName: 'Иванович',
    position: 'Электрик',
    department: DEMO_DEPARTMENTS.electricians,
    colorIndex: 0,
    active: true,
  },
  {
    firstName: 'Анна',
    lastName: 'Петрова',
    middleName: 'Сергеевна',
    position: 'Диспетчер',
    department: DEMO_DEPARTMENTS.dispatch,
    colorIndex: 1,
    active: true,
  },
  {
    firstName: 'Пётр',
    lastName: 'Сидоров',
    middleName: 'Алексеевич',
    position: 'Слесарь',
    department: DEMO_DEPARTMENTS.locksmiths,
    colorIndex: 2,
    active: true,
  },
  {
    firstName: 'Мария',
    lastName: 'Кузнецова',
    middleName: 'Игоревна',
    position: 'Оператор',
    department: DEMO_DEPARTMENTS.dispatch,
    colorIndex: 3,
    active: true,
  },
  {
    firstName: 'Алексей',
    lastName: 'Смирнов',
    middleName: 'Петрович',
    position: 'Электромонтёр',
    department: DEMO_DEPARTMENTS.electricians,
    colorIndex: 4,
    active: true,
  },
  {
    firstName: 'Ольга',
    lastName: 'Волкова',
    middleName: 'Дмитриевна',
    position: 'Слесарь',
    department: DEMO_DEPARTMENTS.locksmiths,
    colorIndex: 5,
    active: false,
  },
]

/** Создаёт список демонстрационных работников. */
export function createDemoEmployees(): Employee[] {
  const timestamp = nowISO()
  return DEMO_EMPLOYEE_SEEDS.map((seed) => ({
    id: createId('emp'),
    firstName: seed.firstName,
    lastName: seed.lastName,
    middleName: seed.middleName,
    position: seed.position,
    department: seed.department,
    color: COLOR_PALETTE[seed.colorIndex % COLOR_PALETTE.length]!,
    active: seed.active,
    createdAt: timestamp,
    updatedAt: timestamp,
    archivedAt: seed.active ? null : timestamp,
  }))
}

/** Находит шаблон по названию (демо-данные привязаны к пресетам по имени). */
function templateByName(templates: ScheduleTemplate[], name: string): ScheduleTemplate | undefined {
  return templates.find((template) => template.name === name)
}

/**
 * Создаёт назначения шаблонов.
 * Все назначения начинаются задолго до текущего месяца, поэтому календарь
 * текущего месяца уже полностью заполнен расчётами.
 */
export function createDemoAssignments(
  employees: Employee[],
  templates: ScheduleTemplate[],
): EmployeeTemplateAssignment[] {
  const timestamp = nowISO()
  // Базовая дата: начало месяца два месяца назад — гарантирует заполненный текущий месяц.
  const base = startOfMonth(addMonths(todayISO(), -2))

  const plan: Array<{ employeeIndex: number; templateName: string; startDate: string }> = [
    { employeeIndex: 0, templateName: '2 через 2', startDate: base },
    { employeeIndex: 1, templateName: '5/2 (пятидневка)', startDate: base },
    { employeeIndex: 2, templateName: 'Сутки через трое', startDate: base },
    { employeeIndex: 3, templateName: 'День через день', startDate: base },
    { employeeIndex: 4, templateName: 'Сложный смешанный цикл', startDate: base },
    { employeeIndex: 5, templateName: '2 через 2', startDate: base },
  ]

  const assignments: EmployeeTemplateAssignment[] = []

  for (const item of plan) {
    const employee = employees[item.employeeIndex]
    const template = templateByName(templates, item.templateName)
    if (!employee || !template) continue
    assignments.push({
      id: createId('asg'),
      employeeId: employee.id,
      templateId: template.id,
      startDate: item.startDate,
      endDate: null,
      comment: 'Демонстрационные данные',
      createdAt: timestamp,
    })
  }

  // Демонстрация замены шаблона с определённой даты:
  // инженер Смирнов с середины следующей недели переходит на ночные смены 2/2.
  const smirnov = employees[4]
  const nightTemplate = templateByName(templates, 'Ночные 2 через 2')
  if (smirnov && nightTemplate) {
    const switchDate = addDays(todayISO(), 7)
    const previous = assignments.find(
      (assignment) => assignment.employeeId === smirnov.id && assignment.endDate === null,
    )
    if (previous) previous.endDate = addDays(switchDate, -1)
    assignments.push({
      id: createId('asg'),
      employeeId: smirnov.id,
      templateId: nightTemplate.id,
      startDate: switchDate,
      endDate: null,
      comment: 'Перевод на ночной график',
      createdAt: timestamp,
    })
  }

  return assignments
}

/** Создаёт несколько ручных переопределений дней для демонстрации. */
export function createDemoOverrides(employees: Employee[]): CalendarOverride[] {
  const timestamp = nowISO()
  const today = todayISO()
  const definitions: Array<{
    employeeIndex: number
    date: string
    type: CalendarOverride['type']
    hours?: number
    reason: string
  }> = [
    {
      employeeIndex: 0,
      date: addDays(today, 2),
      type: 'OFF',
      reason: 'Отгул за переработку (согласовано с руководителем)',
    },
    {
      employeeIndex: 1,
      date: addDays(today, 5),
      type: 'VACATION',
      reason: 'Один день из ежегодного отпуска',
    },
    {
      employeeIndex: 2,
      date: addDays(today, -1),
      type: 'SICK',
      reason: 'Больничный лист №123',
    },
    {
      employeeIndex: 4,
      date: today,
      type: 'NIGHT',
      hours: 12,
      reason: 'Обмен сменами с коллегой',
    },
  ]

  const result: CalendarOverride[] = []

  for (const definition of definitions) {
    const employee = employees[definition.employeeIndex]
    if (!employee) continue
    result.push({
      id: createId('ovr'),
      employeeId: employee.id,
      date: definition.date,
      type: definition.type,
      ...(definition.hours === undefined ? {} : { hours: definition.hours }),
      reason: definition.reason,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
  }

  return result
}

/** Полный набор демонстрационных данных. */
export function createDemoData(): AppData {
  const timestamp = nowISO()
  const templates = createPresetTemplates(startOfMonth(addMonths(todayISO(), -2)), timestamp)
  const employees = createDemoEmployees()
  const assignments = createDemoAssignments(employees, templates)
  const overrides = createDemoOverrides(employees)

  return {
    version: SCHEMA_VERSION,
    templates,
    employees,
    assignments,
    overrides,
    settings: { ...DEFAULT_SETTINGS },
    meta: { app: APP_NAME, createdAt: timestamp, updatedAt: timestamp },
  }
}
