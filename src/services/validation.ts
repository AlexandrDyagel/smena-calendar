import type {
  AppData,
  CalendarOverride,
  Employee,
  EmployeeTemplateAssignment,
  ImportResult,
  ScheduleTemplate,
  ShiftTypeCode,
  TemplateSegment,
} from '@/types'
import { normalizeHours, normalizeShiftCode } from '@/constants/shift-types'
import { isValidISODate, todayISO } from '@/utils/date'
import { createId, nowISO } from '@/utils/id'
import { normalizeHex, paletteColor } from '@/utils/color'
import { DEFAULT_SETTINGS, SCHEMA_VERSION, migrateAppData } from './migrations'

/**
 * Проверка и «мягкая» нормализация импортируемых данных.
 *
 * Принцип: некорректная запись отбрасывается с предупреждением, а не ломает импорт целиком.
 */

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  return fallback
}

function asOptionalString(value: unknown): string | undefined {
  const text = asString(value).trim()
  return text ? text : undefined
}

/** Приводит дату к ISO-строке, иначе возвращает null. */
function asISODate(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (isValidISODate(trimmed)) return trimmed
    if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed) && isValidISODate(trimmed.slice(0, 10))) {
      return trimmed.slice(0, 10)
    }
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear()
    const m = String(value.getMonth() + 1).padStart(2, '0')
    const d = String(value.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  return null
}

function sanitizeSegments(raw: unknown, warnings: string[], templateName: string): TemplateSegment[] {
  const segments: TemplateSegment[] = []
  asArray(raw).forEach((item, index) => {
    const record = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>
    const type = (normalizeShiftCode(record.type) ?? normalizeShiftCode(record.code)) as ShiftTypeCode | null
    if (!type) {
      warnings.push(`Шаблон «${templateName}»: сегмент №${index + 1} пропущен — неизвестный тип смены`)
      return
    }
    segments.push({
      id: asOptionalString(record.id) ?? createId('seg'),
      type,
      hours: normalizeHours(type, record.hours),
      ...(asOptionalString(record.label) ? { label: asOptionalString(record.label) } : {}),
      ...(asOptionalString(record.note) ? { note: asOptionalString(record.note) } : {}),
    })
  })
  return segments
}

function sanitizeTemplates(raw: unknown, warnings: string[]): ScheduleTemplate[] {
  const result: ScheduleTemplate[] = []
  const seen = new Set<string>()

  asArray(raw).forEach((item, index) => {
    const record = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>
    const name = asString(record.name).trim()
    if (!name) {
      warnings.push(`Шаблон №${index + 1} пропущен: не указано название`)
      return
    }
    let id = asOptionalString(record.id) ?? createId('tpl')
    if (seen.has(id)) {
      warnings.push(`Шаблон «${name}»: повторяющийся идентификатор заменён`)
      id = createId('tpl')
    }
    seen.add(id)

    const segments = sanitizeSegments(record.segments, warnings, name)
    if (segments.length === 0) {
      warnings.push(`Шаблон «${name}»: цикл пуст — такой шаблон нельзя назначить работнику`)
    }

    result.push({
      id,
      name,
      description: asOptionalString(record.description) ?? '',
      segments,
      startDate: asISODate(record.startDate) ?? todayISO(),
      color: normalizeHex(record.color, paletteColor(index)),
      isPreset: record.isPreset === true,
      createdAt: asString(record.createdAt, nowISO()),
      updatedAt: asString(record.updatedAt, nowISO()),
    })
  })

  return result
}

function sanitizeEmployees(raw: unknown, warnings: string[]): Employee[] {
  const result: Employee[] = []
  const seen = new Set<string>()

  asArray(raw).forEach((item, index) => {
    const record = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>
    const firstName = asString(record.firstName).trim()
    const lastName = asString(record.lastName).trim()
    if (!firstName || !lastName) {
      warnings.push(`Работник №${index + 1} пропущен: не заполнены имя и фамилия`)
      return
    }
    let id = asOptionalString(record.id) ?? createId('emp')
    if (seen.has(id)) id = createId('emp')
    seen.add(id)

    result.push({
      id,
      firstName,
      lastName,
      middleName: asOptionalString(record.middleName),
      position: asOptionalString(record.position),
      department: asOptionalString(record.department),
      color: normalizeHex(record.color, paletteColor(index)),
      active: record.active !== false,
      createdAt: asString(record.createdAt, nowISO()),
      updatedAt: asOptionalString(record.updatedAt),
      archivedAt: asOptionalString(record.archivedAt) ?? null,
    })
  })

  return result
}

function sanitizeAssignments(
  raw: unknown,
  employees: Employee[],
  templates: ScheduleTemplate[],
  warnings: string[],
): EmployeeTemplateAssignment[] {
  const result: EmployeeTemplateAssignment[] = []
  const employeeIds = new Set(employees.map((employee) => employee.id))
  const templateIds = new Set(templates.map((template) => template.id))

  asArray(raw).forEach((item, index) => {
    const record = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>
    const employeeId = asOptionalString(record.employeeId)
    const templateId = asOptionalString(record.templateId)
    const startDate = asISODate(record.startDate)

    if (!employeeId || !employeeIds.has(employeeId)) {
      warnings.push(`Назначение №${index + 1} пропущено: работник не найден`)
      return
    }
    if (!templateId || !templateIds.has(templateId)) {
      warnings.push(`Назначение №${index + 1} пропущено: шаблон не найден`)
      return
    }
    if (!startDate) {
      warnings.push(`Назначение №${index + 1} пропущено: некорректная дата начала`)
      return
    }

    const endDate = asISODate(record.endDate)
    result.push({
      id: asOptionalString(record.id) ?? createId('asg'),
      employeeId,
      templateId,
      startDate,
      endDate: endDate ?? null,
      comment: asOptionalString(record.comment),
      createdAt: asString(record.createdAt, nowISO()),
    })
  })

  return result
}

function sanitizeOverrides(
  raw: unknown,
  employees: Employee[],
  warnings: string[],
): CalendarOverride[] {
  const result: CalendarOverride[] = []
  const employeeIds = new Set(employees.map((employee) => employee.id))

  asArray(raw).forEach((item, index) => {
    const record = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>
    const employeeId = asOptionalString(record.employeeId)
    const date = asISODate(record.date ?? record.day)
    const type = normalizeShiftCode(record.type)

    if (!employeeId || !employeeIds.has(employeeId)) {
      warnings.push(`Переопределение №${index + 1} пропущено: работник не найден`)
      return
    }
    if (!date) {
      warnings.push(`Переопределение №${index + 1} пропущено: некорректная дата`)
      return
    }
    if (!type) {
      warnings.push(`Переопределение №${index + 1} пропущено: неизвестный тип дня`)
      return
    }

    const rawHours = record.hours
    const hours = rawHours === undefined || rawHours === null ? undefined : normalizeHours(type, rawHours)

    result.push({
      id: asOptionalString(record.id) ?? createId('ovr'),
      employeeId,
      date,
      type,
      ...(hours === undefined ? {} : { hours }),
      reason: asOptionalString(record.reason),
      createdAt: asString(record.createdAt, nowISO()),
      updatedAt: asString(record.updatedAt ?? record.createdAt, nowISO()),
    })
  })

  return result
}

/** Полная проверка и нормализация набора данных. */
export function sanitizeAppData(raw: unknown): { data: AppData; warnings: string[] } {
  const warnings: string[] = []
  const record = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>

  const templates = sanitizeTemplates(record.templates, warnings)
  const employees = sanitizeEmployees(record.employees, warnings)
  const assignments = sanitizeAssignments(record.assignments, employees, templates, warnings)
  const overrides = sanitizeOverrides(record.overrides, employees, warnings)

  const settingsRecord = (typeof record.settings === 'object' && record.settings !== null
    ? record.settings
    : {}) as Record<string, unknown>

  const theme = settingsRecord.theme
  const weekStartsOn = Number(settingsRecord.weekStartsOn)

  const data: AppData = {
    version: SCHEMA_VERSION,
    templates,
    employees,
    assignments,
    overrides,
    settings: {
      ...DEFAULT_SETTINGS,
      theme: theme === 'light' || theme === 'dark' || theme === 'system' ? theme : DEFAULT_SETTINGS.theme,
      weekStartsOn: weekStartsOn === 7 ? 7 : 1,
      showWeekNumbers: settingsRecord.showWeekNumbers !== false,
      highlightHolidays: settingsRecord.highlightHolidays !== false,
      defaultShiftHours:
        Number.isFinite(Number(settingsRecord.defaultShiftHours)) && Number(settingsRecord.defaultShiftHours) > 0
          ? Number(settingsRecord.defaultShiftHours)
          : DEFAULT_SETTINGS.defaultShiftHours,
    },
    meta: {
      app: asString((record.meta as Record<string, unknown> | undefined)?.app, 'smena-calendar'),
      createdAt: asString((record.meta as Record<string, unknown> | undefined)?.createdAt, nowISO()),
      updatedAt: nowISO(),
    },
  }

  return { data, warnings }
}

/**
 * Разбирает текст JSON-файла импорта.
 * Поддерживает как полный конверт { app, data }, так и «сырой» набор данных.
 * Бросает исключение только если JSON нечитаем или в нём нет ни одной сущности.
 */
export function parseImportText(text: string): ImportResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Файл не является корректным JSON')
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Ожидался объект с данными приложения')
  }

  const root = parsed as Record<string, unknown>
  const payload = 'data' in root ? root.data : root

  const { data, warnings } = migrateAppData(payload, { sanitize: sanitizeAppData })

  if (
    data.templates.length === 0 &&
    data.employees.length === 0 &&
    data.assignments.length === 0 &&
    data.overrides.length === 0
  ) {
    throw new Error('В файле нет ни одного шаблона, работника, назначения или переопределения')
  }

  return {
    data,
    warnings,
    stats: {
      templates: data.templates.length,
      employees: data.employees.length,
      assignments: data.assignments.length,
      overrides: data.overrides.length,
    },
  }
}
