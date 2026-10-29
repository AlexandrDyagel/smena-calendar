import type {
  AppData,
  CalendarCell,
  DateRange,
  Employee,
  ExportBundle,
  ReportResult,
  ReportRow,
  ScheduleTemplate,
} from '@/types'
import { getShiftMeta } from '@/constants/shift-types'
import { fullName } from './employee'
import { formatDateHuman, formatISO, toISODate } from './date'
import { nowISO } from './id'

/**
 * Экспорт данных: CSV, JSON (iCal ниже).
 * Модуль не зависит от Vue — только чистые функции и работа с Blob.
 */

/** Описание колонки CSV. */
export interface CsvColumn<T> {
  key: string
  title: string
  value: (row: T) => string | number | null | undefined
}

/** Экранирует значение по правилам CSV (RFC 4180). */
function escapeCsvValue(value: string | number | null | undefined, delimiter: string): string {
  if (value === null || value === undefined) return ''
  const text = String(value)
  const needsQuotes =
    text.includes(delimiter) || text.includes('"') || text.includes('\n') || text.includes('\r')
  if (!needsQuotes) return text
  return `"${text.replace(/"/g, '""')}"`
}

/**
 * Формирует CSV-текст.
 * Разделитель по умолчанию «;» — так файл корректно открывается в русском Excel.
 * BOM добавляется, чтобы Excel не ломал кириллицу.
 */
export function toCsv<T>(
  rows: T[],
  columns: Array<CsvColumn<T>>,
  options: { delimiter?: string; withBom?: boolean } = {},
): string {
  const delimiter = options.delimiter ?? ';'
  const withBom = options.withBom ?? true
  const header = columns.map((column) => escapeCsvValue(column.title, delimiter)).join(delimiter)
  const body = rows
    .map((row) => columns.map((column) => escapeCsvValue(column.value(row), delimiter)).join(delimiter))
    .join('\r\n')
  const content = body ? `${header}\r\n${body}` : header
  return withBom ? `\uFEFF${content}` : content
}

/** Скачивает файл через нативный Blob. */
export function downloadBlob(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  // Освобождаем память после того, как браузер начал скачивание.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Имя файла с периодом: `shifts-2026-01-01_2026-01-31.csv`. */
export function exportFilename(prefix: string, extension: string, range?: DateRange): string {
  const stamp = toISODate(new Date()).replace(/-/g, '')
  if (!range) return `${prefix}-${stamp}.${extension}`
  return `${prefix}-${range.from}_${range.to}.${extension}`
}

/** Читает выбранный пользователем файл как текст. */
export function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'))
    reader.readAsText(file, 'utf-8')
  })
}

/** Строка экспорта календаря (плоская таблица «день × работник»). */
export interface ScheduleCsvRow {
  date: string
  weekday: string
  employee: string
  department: string
  shift: string
  hours: number
  source: string
  template: string
  comment: string
}

const SOURCE_LABELS: Record<CalendarCell['source'], string> = {
  override: 'Изменено вручную',
  template: 'По шаблону',
  none: 'Не размечено',
  'missing-template': 'Шаблон не найден',
}

/** Преобразует вычисленные дни в плоские строки для CSV. */
export function buildScheduleRows(
  cells: CalendarCell[],
  employeesById: Map<string, Employee>,
  templatesById: Map<string, ScheduleTemplate>,
): ScheduleCsvRow[] {
  return cells.map((cell) => {
    const employee = employeesById.get(cell.employeeId)
    const template = cell.templateId ? templatesById.get(cell.templateId) : undefined
    const comment = cell.source === 'override' ? cell.reason ?? '' : cell.note ?? ''
    return {
      date: formatISO(cell.date, 'YYYY-MM-DD'),
      weekday: formatISO(cell.date, 'dddd'),
      employee: employee ? fullName(employee) : 'Неизвестный работник',
      department: employee?.department ?? '',
      shift: cell.type ? getShiftMeta(cell.type).label : '—',
      hours: cell.hours,
      source: SOURCE_LABELS[cell.source],
      template: template?.name ?? (cell.templateName || '—'),
      comment,
    }
  })
}

/** CSV с полным расписанием за период. */
export function buildScheduleCsv(
  cells: CalendarCell[],
  employeesById: Map<string, Employee>,
  templatesById: Map<string, ScheduleTemplate>,
): string {
  const rows = buildScheduleRows(cells, employeesById, templatesById)
  const columns: Array<CsvColumn<ScheduleCsvRow>> = [
    { key: 'date', title: 'Дата', value: (row) => row.date },
    { key: 'weekday', title: 'День недели', value: (row) => row.weekday },
    { key: 'employee', title: 'Сотрудник', value: (row) => row.employee },
    { key: 'department', title: 'Отдел', value: (row) => row.department },
    { key: 'shift', title: 'Тип смены', value: (row) => row.shift },
    { key: 'hours', title: 'Часы', value: (row) => row.hours },
    { key: 'source', title: 'Источник', value: (row) => row.source },
    { key: 'template', title: 'Шаблон', value: (row) => row.template },
    { key: 'comment', title: 'Комментарий', value: (row) => row.comment },
  ]
  return toCsv(rows, columns)
}

/** CSV сводного отчёта по работникам. */
export function buildReportCsv(report: ReportResult): string {
  const columns: Array<CsvColumn<ReportRow>> = [
    { key: 'employee', title: 'Сотрудник', value: (row) => row.employeeName },
    { key: 'department', title: 'Отдел', value: (row) => row.department },
    { key: 'position', title: 'Должность', value: (row) => row.position },
    { key: 'work', title: 'Рабочих смен', value: (row) => row.workShifts },
    { key: 'day', title: 'Дневных', value: (row) => row.dayShifts },
    { key: 'night', title: 'Ночных', value: (row) => row.nightShifts },
    { key: 'full', title: 'Суточных', value: (row) => row.fullShifts },
    { key: 'custom', title: 'Прочих смен', value: (row) => row.customShifts },
    { key: 'hours', title: 'Часов всего', value: (row) => row.hoursTotal },
    { key: 'off', title: 'Выходных по графику', value: (row) => row.offDays },
    { key: 'vacation', title: 'Дней отпуска', value: (row) => row.vacationDays },
    { key: 'sick', title: 'Дней больничного', value: (row) => row.sickDays },
    { key: 'manual', title: 'Изменено вручную', value: (row) => row.manualOverrides },
    { key: 'unassigned', title: 'Не размечено', value: (row) => row.unassignedDays },
    { key: 'days', title: 'Дней в периоде', value: (row) => row.daysTotal },
  ]
  const csv = toCsv(report.rows, columns, { withBom: false })
  const periodLine = `Период;${report.period.from};${report.period.to};дней;${report.days}`
  // BOM обязан быть первым символом файла: иначе Excel читает его как ANSI
  // и кириллица превращается в кракозябры (строка периода раньше стояла до BOM).
  return `\uFEFF${periodLine}\r\n${csv}`
}

/** JSON-файл со всей конфигурацией приложения. */
export function buildJsonBundle(
  data: AppData,
  meta: { app: string; appVersion: string; schemaVersion: number },
): string {
  const bundle: ExportBundle = {
    app: meta.app,
    appVersion: meta.appVersion,
    schemaVersion: meta.schemaVersion,
    exportedAt: nowISO(),
    data,
  }
  return JSON.stringify(bundle, null, 2)
}

/* ------------------------------- iCalendar ------------------------------- */

/** Экранирует текст по правилам iCalendar (RFC 5545). */
function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/** Сворачивает длинные строки iCalendar по 74 символа (требование RFC 5545). */
function foldIcsLine(line: string): string {
  if (line.length <= 74) return line
  const parts: string[] = []
  let rest = line
  parts.push(rest.slice(0, 74))
  rest = rest.slice(74)
  while (rest.length > 0) {
    parts.push(` ${rest.slice(0, 73)}`)
    rest = rest.slice(73)
  }
  return parts.join('\r\n')
}

/** Метка времени iCalendar в UTC: 20260131T091500Z. */
function icsTimestamp(date: Date): string {
  return `${date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`
}

/** Дата iCalendar без времени: 20260131. */
function icsDate(iso: string): string {
  return iso.replace(/-/g, '')
}

export interface IcsOptions {
  /** Название календаря. */
  calendarName?: string
  /** Включать ли нерабочие дни (выходные, отпуска, больничные). */
  includeOffDays?: boolean
  /** Идентификатор-суффикс для UID событий. */
  domain?: string
}

/**
 * Формирует .ics с рабочими сменами как событиями календаря.
 * Используется упрощённая, но валидная схема: событие на весь день.
 */
export function buildIcs(
  cells: CalendarCell[],
  employeesById: Map<string, Employee>,
  options: IcsOptions = {},
): string {
  const includeOffDays = options.includeOffDays ?? false
  const domain = options.domain ?? 'smena-calendar'
  const stamp = icsTimestamp(new Date())
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Smena Calendar//Календарь сменных графиков//RU',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(options.calendarName ?? 'Смены сотрудников')}`,
    'X-WR-TIMEZONE:Europe/Moscow',
  ]

  for (const cell of cells) {
    if (!cell.type) continue
    const meta = getShiftMeta(cell.type)
    if (!includeOffDays && !meta.isWork) continue
    const employee = employeesById.get(cell.employeeId)
    if (!employee) continue

    const summary = `${fullName(employee)} — ${meta.label}`
    const descriptionParts = [
      `Смена: ${meta.label}`,
      `Часов: ${cell.hours}`,
      `Источник: ${cell.source === 'override' ? 'изменено вручную' : 'по шаблону'}`,
      cell.templateName ? `Шаблон: ${cell.templateName}` : '',
      cell.reason ? `Причина: ${cell.reason}` : '',
      cell.note ? `Комментарий: ${cell.note}` : '',
    ].filter(Boolean)

    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${cell.employeeId}-${icsDate(cell.date)}@${domain}`)
    lines.push(`DTSTAMP:${stamp}`)
    lines.push(`DTSTART;VALUE=DATE:${icsDate(cell.date)}`)
    lines.push(`DTEND;VALUE=DATE:${icsDate(addOneDayIso(cell.date))}`)
    lines.push(foldIcsLine(`SUMMARY:${escapeIcsText(summary)}`))
    lines.push(foldIcsLine(`DESCRIPTION:${escapeIcsText(descriptionParts.join('\n'))}`))
    lines.push(foldIcsLine(`CATEGORIES:${escapeIcsText(meta.label)}`))
    lines.push(`STATUS:CONFIRMED`)
    lines.push(`TRANSP:OPAQUE`)
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

/** Следующий день для DTEND (конец события «на весь день» не включается). */
function addOneDayIso(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const next = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1))
  next.setUTCDate(next.getUTCDate() + 1)
  return next.toISOString().slice(0, 10)
}

/** Текст сводки для экспорта в виде обычного текста (используется на экране данных). */
export function describeExportRange(range: DateRange): string {
  return `${formatDateHuman(range.from)} — ${formatDateHuman(range.to)}`
}
