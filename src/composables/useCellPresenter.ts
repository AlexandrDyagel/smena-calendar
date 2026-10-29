import type { CalendarCell, Employee, ShiftTypeMeta } from '@/types'
import { getShiftMeta } from '@/constants/shift-types'
import { formatDateHuman, formatWeekdayLong } from '@/utils/date'
import { shortName } from '@/utils/employee'
import { useEmployeesStore } from '@/stores/employees'
import { useTemplatesStore } from '@/stores/templates'

/** Текстовые представления вычисленного дня: используются в ячейках, таблицах и подсказках. */
export function useCellPresenter() {
  const employeesStore = useEmployeesStore()
  const templatesStore = useTemplatesStore()

  function metaOf(cell: CalendarCell): ShiftTypeMeta | null {
    return cell.type ? getShiftMeta(cell.type) : null
  }

  function employeeOf(cell: CalendarCell): Employee | undefined {
    return employeesStore.getById(cell.employeeId)
  }

  function employeeLabel(cell: CalendarCell): string {
    const employee = employeeOf(cell)
    return employee ? shortName(employee) : 'Работник удалён'
  }

  function templateLabel(cell: CalendarCell): string {
    if (cell.source === 'override') return 'Ручное изменение'
    if (cell.templateId) return templatesStore.nameOf(cell.templateId)
    return '—'
  }

  /** Подпись источника изменения дня. */
  function sourceLabel(cell: CalendarCell): string {
    switch (cell.source) {
      case 'override':
        return 'Изменено вручную'
      case 'template':
        return 'По шаблону'
      case 'missing-template':
        return 'Шаблон не найден'
      default:
        return 'Не размечено'
    }
  }

  /** Часы в компактном виде: «12 ч», «—» для нуля. */
  function hoursLabel(cell: CalendarCell): string {
    if (!cell.hours) return '—'
    return `${cell.hours} ч`
  }

  /** Название типа смены. */
  function shiftLabel(cell: CalendarCell): string {
    const meta = metaOf(cell)
    return meta ? meta.label : 'Не размечено'
  }

  /** Строки подсказки при наведении на день. */
  function tooltipLines(cells: CalendarCell[]): string[] {
    if (cells.length === 0) return ['Нет данных по выбранным фильтрам']
    return cells.map((cell) => {
      const meta = metaOf(cell)
      const parts = [
        employeeLabel(cell),
        meta ? meta.label : 'Не размечено',
        cell.hours ? `${cell.hours} ч` : '',
        cell.source === 'override' ? '(вручную)' : '',
      ].filter(Boolean)
      return parts.join(' · ')
    })
  }

  /** Полное описание дня для панели деталей. */
  function describe(cell: CalendarCell): string {
    const pieces: string[] = [shiftLabel(cell)]
    if (cell.hours) pieces.push(`${cell.hours} ч`)
    if (cell.templateName) pieces.push(cell.templateName)
    return pieces.join(' · ')
  }

  /** «31 января 2026, суббота». */
  function dateTitle(date: string): string {
    return `${formatDateHuman(date)}, ${formatWeekdayLong(date)}`
  }

  return {
    metaOf,
    employeeOf,
    employeeLabel,
    templateLabel,
    sourceLabel,
    hoursLabel,
    shiftLabel,
    tooltipLines,
    describe,
    dateTitle,
  }
}
