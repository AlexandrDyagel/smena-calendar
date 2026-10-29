<script setup lang="ts">
import { computed, ref } from 'vue'
import type { CalendarCell, Employee, EmployeeTemplateAssignment, ISODate } from '@/types'
import { getShiftMeta } from '@/constants/shift-types'
import { formatDateHuman, formatISO } from '@/utils/date'
import { matchesEmployeeFilters, matchesShiftFilters } from '@/utils/filters'
import { useUiStore } from '@/stores/ui'
import { useScheduleStore } from '@/stores/schedule'
import { useTemplatesStore } from '@/stores/templates'
import { useCellPresenter } from '@/composables/useCellPresenter'
import { useBackHandler } from '@/composables/useBackHandler'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import AppIcon from '@/components/ui/AppIcon.vue'
import AppButton from '@/components/ui/AppButton.vue'
import ShiftBadge from './ShiftBadge.vue'
import OverrideForm from './OverrideForm.vue'

const props = defineProps<{
  date: ISODate | null
  employees: Employee[]
}>()

const open = defineModel<boolean>('open', { default: false })

const scheduleStore = useScheduleStore()
const templatesStore = useTemplatesStore()
const ui = useUiStore()
const { employeeLabel, templateLabel, sourceLabel } = useCellPresenter()
const { confirm } = useConfirm()
const toast = useToast()

/** Работник, для которого открыта форма переопределения. */
const editingEmployeeId = ref<string | null>(null)

interface Row {
  employee: Employee
  cell: CalendarCell
  /** Ближайшее будущее назначение — показывается вместо «шаблон не назначен». */
  upcoming: EmployeeTemplateAssignment | null
}

/** Все работники с вычисленным днём — до применения фильтров. */
const allRows = computed<Row[]>(() => {
  if (!props.date) return []
  return props.employees
    .filter((employee) => matchesEmployeeFilters(employee, ui.filters))
    .map((employee) => {
      const cell = scheduleStore.resolveDay(employee.id, props.date!)
      const upcoming =
        cell.source === 'none' || cell.source === 'missing-template'
          ? scheduleStore.nextAssignmentFor(employee.id, props.date!)
          : null
      return { employee, cell, upcoming }
    })
    .sort((a, b) => a.employee.lastName.localeCompare(b.employee.lastName, 'ru'))
})

/**
 * Строки панели подчиняются тем же фильтрам, что и сетка календаря:
 * при включённом «Только рабочие смены» выходные в деталях дня не показываются.
 */
const rows = computed(() => allRows.value.filter((row) => matchesShiftFilters(row.cell, ui.filters)))

/** Сколько работников скрыто фильтрами по сменам. */
const hiddenByFilters = computed(() => allRows.value.length - rows.value.length)

/** Пояснение, какой именно фильтр скрыл строки. */
const hiddenReason = computed(() => {
  const byWorkDays = ui.filters.onlyWorkDays
  const byTypes = ui.filters.shiftTypes.length > 0
  if (byWorkDays && byTypes) return 'Скрыто фильтрами по сменам'
  if (byWorkDays) return 'Скрыто фильтром «Только рабочие смены»'
  return 'Скрыто фильтром по типам смен'
})

const stats = computed(() => {
  const result = { work: 0, off: 0, vacation: 0, sick: 0, hours: 0, manual: 0, unassigned: 0 }
  for (const row of rows.value) {
    result.hours += row.cell.hours || 0
    if (row.cell.source === 'override') result.manual += 1
    if (!row.cell.type) {
      result.unassigned += 1
      continue
    }
    const meta = getShiftMeta(row.cell.type)
    if (meta.isWork) result.work += 1
    else if (row.cell.type === 'VACATION') result.vacation += 1
    else if (row.cell.type === 'SICK') result.sick += 1
    else if (meta.isOff) result.off += 1
  }
  return result
})

const conflicts = computed(() => {
  if (!props.date) return []
  return rows.value.filter((row) => row.cell.conflict)
})

function close(): void {
  editingEmployeeId.value = null
  open.value = false
}

// Системная кнопка «Назад» на Android закрывает панель дня.
useBackHandler(open, close)

async function clearOverride(row: Row): Promise<void> {
  const ok = await confirm({
    title: 'Вернуть день к расчёту по шаблону?',
    message: `Переопределение для ${employeeLabel(row.cell)} будет удалено.`,
    details: row.cell.reason ? [`Причина: ${row.cell.reason}`] : undefined,
    confirmLabel: 'Вернуть к шаблону',
  })
  if (!ok) return
  scheduleStore.clearOverride(row.employee.id, props.date!)
  toast.success('Переопределение удалено', 'День снова рассчитывается по шаблону')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="sc-fade">
      <div v-if="open" class="fixed inset-0 z-40 flex justify-end bg-slate-900/40" @click.self="close">
        <aside
          data-testid="day-details"
          class="sc-scroll flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        >
          <header
            class="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900"
          >
            <div>
              <p class="text-xs uppercase tracking-wide text-slate-400">Детали дня</p>
              <h2 class="text-base font-semibold capitalize text-slate-900 dark:text-slate-100">
                {{ date ? formatISO(date, 'D MMMM YYYY, dddd') : '—' }}
              </h2>
              <p class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                <span>Рабочих смен: <strong>{{ stats.work }}</strong></span>
                <span>Выходных: <strong>{{ stats.off }}</strong></span>
                <span v-if="stats.vacation">Отпуск: <strong>{{ stats.vacation }}</strong></span>
                <span v-if="stats.sick">Больничный: <strong>{{ stats.sick }}</strong></span>
                <span>Часов: <strong>{{ stats.hours }}</strong></span>
                <span v-if="stats.manual" class="text-blue-600 dark:text-blue-400">
                  Вручную изменено: <strong>{{ stats.manual }}</strong>
                </span>
              </p>
            </div>

            <button
              type="button"
              class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
              aria-label="Закрыть панель"
              @click="close"
            >
              <AppIcon name="close" :size="18" />
            </button>
          </header>

          <div class="space-y-3 px-5 py-4">
            <div
              v-if="conflicts.length"
              class="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
            >
              <p class="flex items-center gap-1.5 font-medium">
                <AppIcon name="alert" :size="14" />
                Обнаружены пересечения назначений
              </p>
              <p class="mt-1">
                {{ conflicts.map((row) => employeeLabel(row.cell)).join(', ') }} — на дату активно
                несколько шаблонов. Показано последнее начавшееся назначение.
              </p>
            </div>

            <!-- Фильтры календаря действуют и здесь: показываем, кого они скрыли -->
            <div
              v-if="hiddenByFilters > 0"
              class="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300"
            >
              <AppIcon name="filter" :size="14" />
              <span>
                {{ hiddenReason }}: <strong>{{ hiddenByFilters }}</strong>
              </span>
              <AppButton
                size="sm"
                variant="secondary"
                class="ml-auto"
                @click="ui.clearShiftFilters()"
              >
                Показать всех
              </AppButton>
            </div>

            <p v-if="rows.length === 0" class="text-sm text-slate-500 dark:text-slate-400">
              {{
                employees.length === 0
                  ? 'Нет сотрудников под текущими фильтрами. Измените фильтры, чтобы увидеть смены.'
                  : 'Все сотрудники скрыты фильтром по сменам. Нажмите «Показать всех».'
              }}
            </p>

            <ul v-else class="space-y-2">
              <li
                v-for="row in rows"
                :key="row.employee.id"
                class="rounded-xl border border-slate-200 p-3 dark:border-slate-800"
              >
                <div class="flex flex-wrap items-center gap-2">
                  <span
                    class="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold text-white"
                    :style="{ backgroundColor: row.employee.color }"
                  >
                    {{ row.employee.lastName.charAt(0) }}{{ row.employee.firstName.charAt(0) }}
                  </span>

                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                      {{ row.employee.lastName }} {{ row.employee.firstName }}
                      {{ row.employee.middleName ?? '' }}
                    </p>
                    <p class="truncate text-xs text-slate-500 dark:text-slate-400">
                      {{ row.employee.position || 'Должность не указана' }}
                      <span v-if="row.employee.department">· {{ row.employee.department }}</span>
                    </p>
                  </div>

                  <ShiftBadge
                    :type="row.cell.type"
                    :hours="row.cell.hours"
                    :source="row.cell.source"
                    size="sm"
                    show-hours
                  />

                  <div class="flex items-center gap-1">
                    <AppButton
                      size="sm"
                      variant="ghost"
                      :title="row.cell.source === 'override' ? 'Изменить переопределение' : 'Переопределить день'"
                      @click="editingEmployeeId = editingEmployeeId === row.employee.id ? null : row.employee.id"
                    >
                      <AppIcon name="pencil" :size="14" />
                    </AppButton>
                    <AppButton
                      v-if="row.cell.source === 'override'"
                      size="sm"
                      variant="ghost"
                      title="Вернуть к шаблону"
                      @click="clearOverride(row)"
                    >
                      <AppIcon name="refresh" :size="14" />
                    </AppButton>
                  </div>
                </div>

                <div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                  <span>Источник: {{ sourceLabel(row.cell) }}</span>
                  <span v-if="row.cell.source !== 'override'">Шаблон: {{ templateLabel(row.cell) }}</span>
                  <span v-if="row.cell.reason" class="text-blue-600 dark:text-blue-400">
                    Причина: {{ row.cell.reason }}
                  </span>
                  <span v-if="row.upcoming" class="text-blue-600 dark:text-blue-400">
                    Шаблон «{{ templatesStore.nameOf(row.upcoming.templateId) }}» начнётся
                    {{ formatDateHuman(row.upcoming.startDate) }}
                  </span>
                  <span v-else-if="row.cell.message">{{ row.cell.message }}</span>
                </div>

                <OverrideForm
                  v-if="editingEmployeeId === row.employee.id && date"
                  class="mt-3"
                  :employee-id="row.employee.id"
                  :employee-name="`${row.employee.lastName} ${row.employee.firstName}`"
                  :date="date"
                  @saved="editingEmployeeId = null"
                  @cancel="editingEmployeeId = null"
                />
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>
