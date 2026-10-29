import { computed, reactive, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import type { DateRange, ISODate, PeriodPreset, ReportByTypeRow, ReportResult } from '@/types'
import {
  addMonths,
  endOfMonth,
  endOfQuarter,
  endOfYear,
  formatRangeTitle,
  isValidISODate,
  normalizeRange,
  startOfMonth,
  startOfQuarter,
  startOfYear,
  todayISO,
} from '@/utils/date'
import { buildReport } from '@/utils/reports'
import { saveTextFile, type FileSaveResult } from '@/services/file-export'
import {
  buildReportCsv,
  exportFilename,
  toCsv,
  type CsvColumn,
} from '@/utils/export'
import { useEmployeesStore } from './employees'
import { useScheduleStore } from './schedule'

/** Стор отчётов: период, фильтры и сводные вычисления. */
export const useReportsStore = defineStore('reports', () => {
  const scheduleStore = useScheduleStore()
  const employeesStore = useEmployeesStore()

  const preset = ref<PeriodPreset>('month')
  const period = reactive<DateRange>({
    from: startOfMonth(todayISO()),
    to: endOfMonth(todayISO()),
  })
  /**
   * Точка отсчёта периода — дата, относительно которой считаются месяц, квартал и год.
   *
   * Нужна именно отдельно от границ диапазона: иначе переключение «Год → Месяц»
   * брало бы за начало янвaрь выбранного года, и отчёт показывал нули.
   */
  const anchorDate = ref<ISODate>(todayISO())
  /** Пустой список — «все работники». */
  const employeeIds = ref<string[]>([])
  const department = ref('')

  /** Работники, попадающие под фильтр отдела. */
  const employeesInScope = computed(() => {
    const all = employeesStore.activeEmployees
    if (!department.value) return all
    return all.filter((employee) => (employee.department ?? '') === department.value)
  })

  /** Итоговый список работников отчёта. */
  const employeesForReport = computed(() => {
    if (employeeIds.value.length === 0) return employeesInScope.value
    const selected = new Set(employeeIds.value)
    return employeesInScope.value.filter((employee) => selected.has(employee.id))
  })

  /** Вычисленные дни за период. */
  const cells = computed(() =>
    scheduleStore.resolveRange(
      employeesForReport.value.map((employee) => employee.id),
      period.from,
      period.to,
    ),
  )

  /** Готовый отчёт. */
  const report = computed<ReportResult>(() =>
    buildReport({
      cells: cells.value,
      employees: employeesForReport.value,
      period: { from: period.from, to: period.to },
    }),
  )

  /** Есть ли данные для отображения. */
  const hasData = computed(() => report.value.rows.length > 0)

  /** Заголовок периода. */
  const periodTitle = computed(() => formatRangeTitle(period.from, period.to))

  /** Диапазон периода задан неверно (начало позже окончания). */
  const isPeriodInvalid = computed(() => period.from > period.to)

  /**
   * Устанавливает стандартный период относительно точки отсчёта.
   * По умолчанию используется текущая точка отсчёта, поэтому «Год → Месяц»
   * возвращает к тому же месяцу, а не к началу года.
   */
  function setPreset(next: PeriodPreset, anchor: ISODate = anchorDate.value): void {
    preset.value = next
    anchorDate.value = anchor
    switch (next) {
      case 'month':
        period.from = startOfMonth(anchor)
        period.to = endOfMonth(anchor)
        break
      case 'quarter':
        period.from = startOfQuarter(anchor)
        period.to = endOfQuarter(anchor)
        break
      case 'year':
        period.from = startOfYear(anchor)
        period.to = endOfYear(anchor)
        break
      default:
        // «Произвольный»: границы остаются такими, какими их задал пользователь.
        break
    }
  }

  /** Изменение одной границы вручную (поля «с» и «по»). */
  function setBoundary(field: 'from' | 'to', value: ISODate): void {
    if (!isValidISODate(value)) return
    if (field === 'from') {
      period.from = value
      anchorDate.value = value
    } else {
      period.to = value
    }
    preset.value = 'custom'
  }

  /** Произвольный диапазон. */
  function setRange(from: ISODate, to: ISODate): void {
    const normalized = normalizeRange(from, to)
    period.from = normalized.from
    period.to = normalized.to
    anchorDate.value = normalized.from
    preset.value = 'custom'
  }

  /** Сдвиг периода на месяц назад/вперёд относительно точки отсчёта. */
  function shiftPeriod(direction: -1 | 1): void {
    const anchor = addMonths(anchorDate.value, direction)
    setPreset(preset.value === 'custom' ? 'month' : preset.value, anchor)
  }

  function toggleEmployee(employeeId: string): void {
    const set = new Set(employeeIds.value)
    if (set.has(employeeId)) set.delete(employeeId)
    else set.add(employeeId)
    employeeIds.value = [...set]
  }

  function setEmployees(ids: string[]): void {
    employeeIds.value = [...ids]
  }

  function resetFilters(): void {
    employeeIds.value = []
    department.value = ''
  }

  /** Экспорт сводного отчёта в CSV. */
  async function exportSummaryCsv(): Promise<{ filename: string; result: FileSaveResult }> {
    const filename = exportFilename('report', 'csv', { from: period.from, to: period.to })
    const result = await saveTextFile(filename, buildReportCsv(report.value), 'text/csv')
    return { filename, result }
  }

  /** Экспорт детализации «сотрудник × тип смены» в CSV. */
  async function exportByTypeCsv(): Promise<{ filename: string; result: FileSaveResult }> {
    const rows: ReportByTypeRow[] = report.value.byType
    const columns: Array<CsvColumn<ReportByTypeRow>> = [
      { key: 'employee', title: 'Сотрудник', value: (row) => row.employeeName },
      { key: 'type', title: 'Тип смены', value: (row) => row.label },
      { key: 'count', title: 'Количество дней', value: (row) => row.count },
      { key: 'hours', title: 'Часы', value: (row) => row.hours },
    ]
    const filename = exportFilename('report-by-type', 'csv', {
      from: period.from,
      to: period.to,
    })
    const result = await saveTextFile(filename, toCsv(rows, columns), 'text/csv')
    return { filename, result }
  }

  // При смене отдела убираем из выбора работников, которых больше нет в области видимости.
  watch(employeesInScope, (list) => {
    if (employeeIds.value.length === 0) return
    const allowed = new Set(list.map((employee) => employee.id))
    const filtered = employeeIds.value.filter((id) => allowed.has(id))
    if (filtered.length !== employeeIds.value.length) employeeIds.value = filtered
  })

  return {
    preset,
    period,
    anchorDate,
    employeeIds,
    department,
    employeesInScope,
    employeesForReport,
    cells,
    report,
    hasData,
    periodTitle,
    isPeriodInvalid,
    setPreset,
    setBoundary,
    setRange,
    shiftPeriod,
    toggleEmployee,
    setEmployees,
    resetFilters,
    exportSummaryCsv,
    exportByTypeCsv,
  }
})
