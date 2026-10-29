/**
 * Доменные модели приложения «Календарь сменных графиков».
 *
 * Все даты календаря хранятся строками формата ISO «YYYY-MM-DD» (без времени),
 * все технические отметки времени — в ISO 8601 UTC.
 */

/** Календарная дата без времени в формате «YYYY-MM-DD» (локальный день пользователя). */
export type ISODate = string

/** Метка времени в формате ISO 8601 (UTC), например «2026-01-31T09:15:00.000Z». */
export type Timestamp = string

/** Коды типов смен и дней. */
export type ShiftTypeCode = 'DAY' | 'NIGHT' | 'FULL' | 'OFF' | 'VACATION' | 'SICK' | 'CUSTOM'

/** Справочные метаданные типа смены. */
export interface ShiftTypeMeta {
  code: ShiftTypeCode
  /** Полное название на русском. */
  label: string
  /** Короткое обозначение для компактных ячеек календаря. */
  shortLabel: string
  /** Основной цвет (HEX). */
  color: string
  /** Количество часов по умолчанию. */
  defaultHours: number
  /** Является ли тип рабочей сменой. */
  isWork: boolean
  /** Является ли тип выходным/нерабочим днём. */
  isOff: boolean
  /** Особый статус (отпуск, больничный и т.п.). */
  isSpecial: boolean
  /** Пояснение для интерфейса. */
  description: string
  /** Порядок вывода в списках и легенде. */
  order: number
}

/** Элемент (сегмент) цикла шаблона. */
export interface TemplateSegment {
  id: string
  type: ShiftTypeCode
  hours: number
  label?: string
  note?: string
}

/** Шаблон сменного графика — циклическая последовательность сегментов. */
export interface ScheduleTemplate {
  id: string
  name: string
  description?: string
  segments: TemplateSegment[]
  /** Дата, с которой цикл считается «первым днём» по умолчанию. */
  startDate: ISODate
  color?: string
  /** Признак встроенного (демонстрационного) шаблона. */
  isPreset: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}

/** Работник. */
export interface Employee {
  id: string
  firstName: string
  lastName: string
  middleName?: string
  position?: string
  department?: string
  color: string
  active: boolean
  createdAt: Timestamp
  updatedAt?: Timestamp
  archivedAt?: Timestamp | null
}

/** Назначение шаблона работнику на период. */
export interface EmployeeTemplateAssignment {
  id: string
  employeeId: string
  templateId: string
  startDate: ISODate
  /** Дата окончания включительно; null/undefined — назначение бессрочное. */
  endDate?: ISODate | null
  comment?: string
  createdAt: Timestamp
}

/** Ручное переопределение конкретного дня конкретного работника. */
export interface CalendarOverride {
  id: string
  employeeId: string
  date: ISODate
  type: ShiftTypeCode
  /** Часы; если не указаны — берутся из справочника типа смены. */
  hours?: number
  reason?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

/** Источник вычисленного значения дня. */
export type CalendarCellSource = 'override' | 'template' | 'none' | 'missing-template'

/** Вычисленное состояние дня работника. */
export interface CalendarCell {
  employeeId: string
  date: ISODate
  source: CalendarCellSource
  type: ShiftTypeCode | null
  hours: number
  templateId?: string
  templateName?: string
  overrideId?: string
  /** Индекс сегмента внутри цикла (с нуля). */
  segmentIndex?: number
  /** Номер прохода цикла (может быть отрицательным для дат до начала). */
  cycleIndex?: number
  /** Длина цикла в днях. */
  cycleLength?: number
  /** Подпись сегмента, если задана в шаблоне. */
  label?: string
  /** Комментарий сегмента шаблона. */
  note?: string
  /** Причина ручного переопределения. */
  reason?: string
  /** Признак конфликта: на дату активно более одного назначения. */
  conflict?: boolean
  /** Идентификаторы конкурирующих назначений. */
  conflictAssignmentIds?: string[]
  /** Пояснение для интерфейса, если день не размечен. */
  message?: string
}

/** Конфликт назначений у работника. */
export interface AssignmentConflict {
  employeeId: string
  assignmentIds: string[]
  startDates: ISODate[]
  /** Дата, на которую обнаружено пересечение (первая найденная). */
  date: ISODate
}

export type ThemeMode = 'light' | 'dark' | 'system'
export type CalendarViewMode = 'month' | 'week' | 'list'
export type PeriodPreset = 'month' | 'quarter' | 'year' | 'custom'

/** Диапазон дат (включительно). */
export interface DateRange {
  from: ISODate
  to: ISODate
}

/** Фильтры календаря. */
export interface CalendarFilters {
  employeeIds: string[]
  departments: string[]
  shiftTypes: ShiftTypeCode[]
  onlyWorkDays: boolean
  showInactive: boolean
}

/** Настройки приложения. */
export interface AppSettings {
  theme: ThemeMode
  /** Первый день недели: 1 — понедельник, 7 — воскресенье. */
  weekStartsOn: 1 | 7
  showWeekNumbers: boolean
  highlightHolidays: boolean
  defaultShiftHours: number
}

/** Полный набор сохраняемых данных приложения. */
export interface AppData {
  version: number
  templates: ScheduleTemplate[]
  employees: Employee[]
  assignments: EmployeeTemplateAssignment[]
  overrides: CalendarOverride[]
  settings: AppSettings
  meta: {
    app: string
    createdAt: Timestamp
    updatedAt: Timestamp
  }
}

/** Конверт, в котором данные лежат в localStorage. */
export interface StorageEnvelope {
  version: number
  savedAt: Timestamp
  data: AppData
}

/** Файл экспорта/импорта JSON. */
export interface ExportBundle {
  app: string
  appVersion: string
  schemaVersion: number
  exportedAt: Timestamp
  data: AppData
}

/** Результат разбора импортируемого JSON. */
export interface ImportResult {
  data: AppData
  warnings: string[]
  stats: {
    templates: number
    employees: number
    assignments: number
    overrides: number
  }
}

/** Строка сводного отчёта по работнику. */
export interface ReportRow {
  employeeId: string
  employeeName: string
  department: string
  position: string
  color: string
  active: boolean
  /** Количество рабочих смен всех видов. */
  workShifts: number
  dayShifts: number
  nightShifts: number
  fullShifts: number
  customShifts: number
  /** Выходные по графику. */
  offDays: number
  vacationDays: number
  sickDays: number
  /** Всего часов за период. */
  hoursTotal: number
  /** Часы по каждому типу смены. */
  hoursByType: Partial<Record<ShiftTypeCode, number>>
  /** Количество дней, изменённых вручную. */
  manualOverrides: number
  /** Дни без назначенного шаблона. */
  unassignedDays: number
  /** Всего дней в периоде. */
  daysTotal: number
}

/** Строка отчёта в разрезе «сотрудник × тип смены». */
export interface ReportByTypeRow {
  employeeId: string
  employeeName: string
  type: ShiftTypeCode
  label: string
  color: string
  count: number
  hours: number
}

/** Итоги отчёта. */
export interface ReportTotals {
  workShifts: number
  offDays: number
  vacationDays: number
  sickDays: number
  hoursTotal: number
  manualOverrides: number
}

/** Готовый отчёт за период. */
export interface ReportResult {
  period: DateRange
  days: number
  rows: ReportRow[]
  byType: ReportByTypeRow[]
  totals: ReportTotals
}
