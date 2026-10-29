import dayjs from 'dayjs'
import 'dayjs/locale/ru'
import type { DateRange, ISODate } from '@/types'
import { holidayName } from '@/constants/holidays'

dayjs.locale('ru')

/** Миллисекунд в сутках. */
export const MS_PER_DAY = 86_400_000

/** Регулярное выражение строгого формата даты. */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Полные названия месяцев на русском. */
export const MONTHS_RU = [
  'январь',
  'февраль',
  'март',
  'апрель',
  'май',
  'июнь',
  'июль',
  'август',
  'сентябрь',
  'октябрь',
  'ноябрь',
  'декабрь',
]

/** Названия месяцев в родительном падеже (для диапазонов). */
export const MONTHS_RU_GENITIVE = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
]

/** Сокращённые названия дней недели, неделя начинается с понедельника. */
export const WEEKDAYS_RU_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

/** Полные названия дней недели, неделя начинается с понедельника. */
export const WEEKDAYS_RU_FULL = [
  'понедельник',
  'вторник',
  'среда',
  'четверг',
  'пятница',
  'суббота',
  'воскресенье',
]

/** Разбирает ISO-дату на числовые компоненты без участия часового пояса. */
export function splitISO(iso: ISODate): { y: number; m: number; d: number } {
  const parts = String(iso).split('-')
  return {
    y: Number(parts[0]),
    m: Number(parts[1]),
    d: Number(parts[2]),
  }
}

function pad(value: number, length = 2): string {
  return String(Math.abs(value)).padStart(length, '0')
}

/**
 * Строгая проверка ISO-даты «YYYY-MM-DD» (включая существование дня в месяце).
 * Возвращает обычный boolean, а не type guard: ISODate — это string,
 * поэтому предикат сужал бы тип до never в ветке «иначе».
 */
export function isValidISODate(value: unknown): boolean {
  if (typeof value !== 'string' || !ISO_DATE_RE.test(value)) return false
  const { y, m, d } = splitISO(value)
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return false
  const probe = new Date(Date.UTC(y, m - 1, d))
  return (
    probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d
  )
}

/**
 * Порядковый номер дня (суток) относительно эпохи.
 * Считается по UTC из компонентов даты, поэтому не зависит от часового пояса
 * и от перехода на летнее время — вся арифметика цикла строится на этом числе.
 */
export function toDayIndex(iso: ISODate): number {
  const { y, m, d } = splitISO(iso)
  return Math.round(Date.UTC(y, m - 1, d) / MS_PER_DAY)
}

/** Обратное преобразование порядкового номера дня в ISO-дату. */
export function fromDayIndex(index: number): ISODate {
  const date = new Date(index * MS_PER_DAY)
  return `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

/** Разница в календарных днях: `to - from` (может быть отрицательной). */
export function diffInDays(from: ISODate, to: ISODate): number {
  return toDayIndex(to) - toDayIndex(from)
}

/** Прибавляет (или вычитает) дни. */
export function addDays(iso: ISODate, amount: number): ISODate {
  return fromDayIndex(toDayIndex(iso) + amount)
}

/** Прибавляет месяцы с «мягким» ограничением дня (31 января + 1 месяц = 28/29 февраля). */
export function addMonths(iso: ISODate, amount: number): ISODate {
  return toISODate(parseISO(iso).add(amount, 'month'))
}

/** Сравнение дат: -1, 0 или 1. */
export function compareISO(a: ISODate, b: ISODate): number {
  const left = toDayIndex(a)
  const right = toDayIndex(b)
  return left === right ? 0 : left < right ? -1 : 1
}

/** Приводит Date/dayjs-объект/строку к ISO-дате по локальному календарю браузера. */
export function toISODate(input: Date | dayjs.Dayjs | string): ISODate {
  if (typeof input === 'string') {
    if (isValidISODate(input)) return input
    const trimmed = input.trim()
    // «2026-01-31T10:00:00.000Z» — берём календарную часть строки
    if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) return trimmed.slice(0, 10)
    const parsed = dayjs(trimmed)
    if (!parsed.isValid()) return todayISO()
    return toISODate(parsed.toDate())
  }
  if (dayjs.isDayjs(input)) return toISODate(input.toDate())
  const y = input.getFullYear()
  const m = input.getMonth() + 1
  const d = input.getDate()
  return `${pad(y, 4)}-${pad(m)}-${pad(d)}`
}

/** dayjs-объект на локальную полночь указанной даты (без UTC-сдвига). */
export function parseISO(iso: ISODate): dayjs.Dayjs {
  const { y, m, d } = splitISO(iso)
  return dayjs(new Date(y, m - 1, d, 0, 0, 0, 0))
}

/** Сегодняшняя дата по локальному календарю. */
export function todayISO(): ISODate {
  return toISODate(new Date())
}

/** День недели: 0 — воскресенье ... 6 — суббота. */
export function dayOfWeek(iso: ISODate): number {
  const { y, m, d } = splitISO(iso)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

/** Индекс дня недели при начале недели с понедельника: 0 — Пн ... 6 — Вс. */
export function weekdayIndexMondayFirst(iso: ISODate): number {
  return (dayOfWeek(iso) + 6) % 7
}

/** Начало недели для даты. */
export function startOfWeek(iso: ISODate, weekStartsOn: 1 | 7 = 1): ISODate {
  const day = dayOfWeek(iso)
  const anchor = weekStartsOn === 7 ? 0 : 1
  const offset = (day - anchor + 7) % 7
  return addDays(iso, -offset)
}

/** Конец недели для даты. */
export function endOfWeek(iso: ISODate, weekStartsOn: 1 | 7 = 1): ISODate {
  return addDays(startOfWeek(iso, weekStartsOn), 6)
}

/** Первое число месяца. */
export function startOfMonth(iso: ISODate): ISODate {
  return `${iso.slice(0, 7)}-01`
}

/** Последнее число месяца. */
export function endOfMonth(iso: ISODate): ISODate {
  return addDays(addMonths(startOfMonth(iso), 1), -1)
}

/** Первый день квартала. */
export function startOfQuarter(iso: ISODate): ISODate {
  const { y, m } = splitISO(iso)
  const firstMonth = Math.floor((m - 1) / 3) * 3 + 1
  return `${pad(y, 4)}-${pad(firstMonth)}-01`
}

/** Последний день квартала. */
export function endOfQuarter(iso: ISODate): ISODate {
  return addDays(addMonths(startOfQuarter(iso), 3), -1)
}

/** Первый день года. */
export function startOfYear(iso: ISODate): ISODate {
  return `${iso.slice(0, 4)}-01-01`
}

/** Последний день года. */
export function endOfYear(iso: ISODate): ISODate {
  return `${iso.slice(0, 4)}-12-31`
}

/** Номер недели по ISO 8601 (неделя начинается с понедельника). */
export function isoWeekNumber(iso: ISODate): number {
  const { y, m, d } = splitISO(iso)
  const date = new Date(Date.UTC(y, m - 1, d))
  const dayNumber = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - dayNumber + 3)
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4))
  const firstDayNumber = (firstThursday.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNumber + 3)
  return 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * MS_PER_DAY))
}

/** Сетка месяца: 42 дня (6 недель), начиная с первого дня недели. */
export function getMonthGrid(anchor: ISODate, weekStartsOn: 1 | 7 = 1): ISODate[] {
  const first = startOfMonth(anchor)
  const gridStart = startOfWeek(first, weekStartsOn)
  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index))
}

/** Семь дат недели, в которую попадает указанный день. */
export function getWeekDates(anchor: ISODate, weekStartsOn: 1 | 7 = 1): ISODate[] {
  const start = startOfWeek(anchor, weekStartsOn)
  return Array.from({ length: 7 }, (_, index) => addDays(start, index))
}

/** Все даты диапазона включительно. */
export function enumerateDates(from: ISODate, to: ISODate): ISODate[] {
  const length = diffInDays(from, to)
  if (length < 0) return []
  return Array.from({ length: length + 1 }, (_, index) => addDays(from, index))
}

/** Количество дней в диапазоне включительно. */
export function rangeLength(from: ISODate, to: ISODate): number {
  return Math.max(0, diffInDays(from, to) + 1)
}

/** Меняет границы местами, если они переданы в обратном порядке. */
export function normalizeRange(from: ISODate, to: ISODate): DateRange {
  return compareISO(from, to) <= 0 ? { from, to } : { from: to, to: from }
}

/** Проверяет корректность диапазона. */
export function isRangeValid(from: unknown, to: unknown): boolean {
  if (typeof from !== 'string' || typeof to !== 'string') return false
  return isValidISODate(from) && isValidISODate(to) && compareISO(from, to) <= 0
}

/** Сегодня ли указанная дата. */
export function isToday(iso: ISODate): boolean {
  return iso === todayISO()
}

/** Выходной ли день (суббота или воскресенье). */
export function isWeekend(iso: ISODate): boolean {
  const day = dayOfWeek(iso)
  return day === 0 || day === 6
}

/**
 * Название государственного праздника для даты либо null.
 * Справочник праздников живёт в constants/holidays.ts — здесь только удобная обёртка.
 */
export function getHolidayName(iso: ISODate): string | null {
  if (!isValidISODate(iso)) return null
  return holidayName(iso.slice(5))
}

/** Праздничный ли день. */
export function isHoliday(iso: ISODate): boolean {
  return getHolidayName(iso) !== null
}

/** Нерабочий ли день по календарю (выходной или праздник). */
export function isDayOff(iso: ISODate): boolean {
  return isWeekend(iso) || isHoliday(iso)
}

/** Форматирование ISO-даты по шаблону dayjs. */
export function formatISO(iso: ISODate, template = 'D MMMM YYYY'): string {
  if (!isValidISODate(iso)) return '—'
  return parseISO(iso).format(template)
}

/** «31 января 2026». */
export function formatDateHuman(iso: ISODate): string {
  return formatISO(iso, 'D MMMM YYYY')
}

/** «31 января». */
export function formatDayMonth(iso: ISODate): string {
  return formatISO(iso, 'D MMMM')
}

/** «суббота». */
export function formatWeekdayLong(iso: ISODate): string {
  return formatISO(iso, 'dddd')
}

/** «Январь 2026» — с заглавной буквы. */
export function formatMonthTitle(iso: ISODate): string {
  const title = formatISO(startOfMonth(iso), 'MMMM YYYY')
  return capitalize(title)
}

/** «1 — 31 января 2026» / «28 декабря 2025 — 10 января 2026». */
export function formatRangeTitle(from: ISODate, to: ISODate): string {
  if (!isValidISODate(from) || !isValidISODate(to)) return '—'
  const sameMonth = from.slice(0, 7) === to.slice(0, 7)
  if (sameMonth) {
    return `${parseISO(from).date()} — ${formatDateHuman(to)}`
  }
  return `${formatDateHuman(from)} — ${formatDateHuman(to)}`
}

/** Заглавная первая буква строки. */
export function capitalize(value: string): string {
  if (!value) return value
  return value.charAt(0).toUpperCase() + value.slice(1)
}

/** Название месяца (1..12) в именительном падеже. */
export function monthNameRu(month: number): string {
  return capitalize(MONTHS_RU[Math.min(Math.max(month, 1), 12) - 1] ?? '')
}

/** Название месяца в родительном падеже. */
export function monthNameGenitive(month: number): string {
  return MONTHS_RU_GENITIVE[Math.min(Math.max(month, 1), 12) - 1] ?? ''
}

/** Выбор правильной формы слова по числу: pluralizeRu(3, ['день', 'дня', 'дней']). */
export function pluralizeRu(count: number, forms: [string, string, string]): string {
  const value = Math.abs(Math.trunc(count)) % 100
  const last = value % 10
  if (value > 10 && value < 20) return forms[2]
  if (last > 1 && last < 5) return forms[1]
  if (last === 1) return forms[0]
  return forms[2]
}

/** «3 дня», «1 день», «11 дней». */
export function formatDaysCount(count: number): string {
  return `${count} ${pluralizeRu(count, ['день', 'дня', 'дней'])}`
}

/** Склонение часов: «8 часов», «1 час», «2 часа». */
export function formatHours(hours: number): string {
  const rounded = Math.round(hours * 100) / 100
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2)
  return `${text} ${pluralizeRu(rounded, ['час', 'часа', 'часов'])}`
}
