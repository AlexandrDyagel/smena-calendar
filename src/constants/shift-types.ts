import type { ISODate, ScheduleTemplate, ShiftTypeCode, TemplateSegment } from '@/types'
import { createId, nowISO } from '@/utils/id'

/**
 * Справочник типов смен и дней.
 *
 * Цвета намеренно заданы как HEX-значения, а не как классы Tailwind:
 * цвета применяются через inline-стили, поэтому не зависят от JIT-сканирования
 * и работают для произвольных типов в будущем.
 */
export const SHIFT_TYPES: Record<ShiftTypeCode, import('@/types').ShiftTypeMeta> = {
  DAY: {
    code: 'DAY',
    label: 'Дневная смена',
    shortLabel: 'Д',
    color: '#16a34a',
    defaultHours: 12,
    isWork: true,
    isOff: false,
    isSpecial: false,
    description: 'Рабочий день, дневная смена',
    order: 10,
  },
  NIGHT: {
    code: 'NIGHT',
    label: 'Ночная смена',
    shortLabel: 'Н',
    color: '#2563eb',
    defaultHours: 12,
    isWork: true,
    isOff: false,
    isSpecial: false,
    description: 'Рабочая ночная смена',
    order: 20,
  },
  FULL: {
    code: 'FULL',
    label: 'Суточная смена',
    shortLabel: 'С',
    color: '#7c3aed',
    defaultHours: 24,
    isWork: true,
    isOff: false,
    isSpecial: false,
    description: 'Сутки: 24 часа',
    order: 30,
  },
  OFF: {
    code: 'OFF',
    label: 'Выходной',
    shortLabel: 'В',
    color: '#94a3b8',
    defaultHours: 0,
    isWork: false,
    isOff: true,
    isSpecial: false,
    description: 'Выходной день по графику',
    order: 40,
  },
  VACATION: {
    code: 'VACATION',
    label: 'Отпуск',
    shortLabel: 'О',
    color: '#f59e0b',
    defaultHours: 0,
    isWork: false,
    isOff: true,
    isSpecial: true,
    description: 'Ежегодный оплачиваемый отпуск',
    order: 50,
  },
  SICK: {
    code: 'SICK',
    label: 'Больничный',
    shortLabel: 'Б',
    color: '#ef4444',
    defaultHours: 0,
    isWork: false,
    isOff: true,
    isSpecial: true,
    description: 'Временная нетрудоспособность',
    order: 60,
  },
  CUSTOM: {
    code: 'CUSTOM',
    label: 'Другое',
    shortLabel: 'Д',
    color: '#0d9488',
    defaultHours: 8,
    isWork: true,
    isOff: false,
    isSpecial: false,
    description: 'Произвольный рабочий день (учёба, подработка и т.п.)',
    order: 70,
  },
}

const FALLBACK_META: import('@/types').ShiftTypeMeta = {
  ...SHIFT_TYPES.CUSTOM,
  code: 'CUSTOM',
  label: 'Неизвестный тип',
}

/** Список типов в порядке отображения. */
export const SHIFT_TYPE_LIST = Object.values(SHIFT_TYPES).sort((a, b) => a.order - b.order)

/** Коды, которые считаются рабочими сменами. */
export const WORK_SHIFT_CODES: ShiftTypeCode[] = SHIFT_TYPE_LIST.filter((t) => t.isWork).map((t) => t.code)

/** Коды нерабочих дней. */
export const OFF_SHIFT_CODES: ShiftTypeCode[] = SHIFT_TYPE_LIST.filter((t) => t.isOff).map((t) => t.code)

/** Коды, доступные для выбора в конструкторе шаблона и в переопределении. */
export const SELECTABLE_SHIFT_CODES: ShiftTypeCode[] = SHIFT_TYPE_LIST.map((t) => t.code)

/** Тип смены по умолчанию для новых сегментов. */
export const DEFAULT_SHIFT_CODE: ShiftTypeCode = 'DAY'

/** Все известные коды одним набором — для быстрой валидации. */
const KNOWN_CODES = new Set<string>(SHIFT_TYPE_LIST.map((t) => t.code))

/** Проверяет, что строка является известным кодом типа смены. */
export function isShiftTypeCode(value: unknown): value is ShiftTypeCode {
  return typeof value === 'string' && KNOWN_CODES.has(value)
}

/** Приводит произвольное значение к известному коду либо к null. */
export function normalizeShiftCode(value: unknown): ShiftTypeCode | null {
  if (typeof value !== 'string') return null
  const upper = value.trim().toUpperCase()
  if (KNOWN_CODES.has(upper)) return upper as ShiftTypeCode
  // поддерживаем русские синонимы при импорте данных
  const aliases: Record<string, ShiftTypeCode> = {
    ДЕНЬ: 'DAY',
    ДНЕВНАЯ: 'DAY',
    НОЧЬ: 'NIGHT',
    НОЧНАЯ: 'NIGHT',
    СУТКИ: 'FULL',
    ВЫХОДНОЙ: 'OFF',
    ОТПУСК: 'VACATION',
    БОЛЬНИЧНЫЙ: 'SICK',
  }
  return aliases[upper] ?? null
}

/** Метаданные типа смены; для неизвестного кода возвращает безопасную заглушку. */
export function getShiftMeta(code: ShiftTypeCode | null | undefined): import('@/types').ShiftTypeMeta {
  if (!code) return FALLBACK_META
  return SHIFT_TYPES[code] ?? FALLBACK_META
}

/** Является ли код рабочей сменой. */
export function isWorkShift(code: ShiftTypeCode | null | undefined): boolean {
  return Boolean(code) && getShiftMeta(code).isWork
}

/** Название типа смены на русском. */
export function shiftLabel(code: ShiftTypeCode | null | undefined): string {
  return getShiftMeta(code).label
}

/** Короткое обозначение типа смены. */
export function shiftShortLabel(code: ShiftTypeCode | null | undefined): string {
  return getShiftMeta(code).shortLabel
}

/** Часы по умолчанию для типа смены. */
export function defaultHoursFor(code: ShiftTypeCode): number {
  return getShiftMeta(code).defaultHours
}

/** Создаёт сегмент шаблона с корректными часами по умолчанию. */
export function createSegment(
  type: ShiftTypeCode = DEFAULT_SHIFT_CODE,
  overrides: Partial<Omit<TemplateSegment, 'id' | 'type'>> = {},
): TemplateSegment {
  return {
    id: createId('seg'),
    type,
    hours: overrides.hours ?? defaultHoursFor(type),
    ...(overrides.label ? { label: overrides.label } : {}),
    ...(overrides.note ? { note: overrides.note } : {}),
  }
}

/** Нормализует часы сегмента: неотрицательное число, для выходных — 0. */
export function normalizeHours(type: ShiftTypeCode, hours: unknown): number {
  const meta = getShiftMeta(type)
  if (meta.isOff) return 0
  const value = typeof hours === 'number' ? hours : Number(hours)
  if (!Number.isFinite(value) || value < 0) return meta.defaultHours
  return Math.min(Math.round(value * 100) / 100, 24)
}

/** Описание шаблона в виде текстовой цепочки: «Д Д В В». */
export function describeSegments(segments: TemplateSegment[]): string {
  return segments.map((s) => shiftShortLabel(s.type)).join(' ')
}

/** Итоговая длительность цикла в часах. */
export function totalCycleHours(segments: TemplateSegment[]): number {
  return segments.reduce((sum, s) => sum + (s.hours || 0), 0)
}

/** Создаёт пустой шаблон (используется как основа в редакторе). */
export function createEmptyTemplate(startDate: ISODate): ScheduleTemplate {
  const timestamp = nowISO()
  return {
    id: createId('tpl'),
    name: '',
    description: '',
    segments: [],
    startDate,
    color: '#2563eb',
    isPreset: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}
