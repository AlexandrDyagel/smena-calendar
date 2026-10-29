<script setup lang="ts">
import { computed } from 'vue'
import type { ReportResult } from '@/types'
import AppIcon from '@/components/ui/AppIcon.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

const props = defineProps<{ report: ReportResult }>()

type SortKey =
  | 'employeeName'
  | 'workShifts'
  | 'dayShifts'
  | 'nightShifts'
  | 'fullShifts'
  | 'hoursTotal'
  | 'offDays'
  | 'vacationDays'
  | 'sickDays'
  | 'manualOverrides'

const sortKey = defineModel<SortKey>('sortKey', { default: 'employeeName' })
const sortDir = defineModel<'asc' | 'desc'>('sortDir', { default: 'asc' })

const columns: Array<{ key: SortKey; title: string; numeric: boolean; hint?: string }> = [
  { key: 'employeeName', title: 'Сотрудник', numeric: false },
  { key: 'workShifts', title: 'Рабочих смен', numeric: true },
  { key: 'dayShifts', title: 'Дневных', numeric: true },
  { key: 'nightShifts', title: 'Ночных', numeric: true },
  { key: 'fullShifts', title: 'Суточных', numeric: true },
  { key: 'hoursTotal', title: 'Часов всего', numeric: true },
  { key: 'offDays', title: 'Выходных', numeric: true },
  { key: 'vacationDays', title: 'Отпуск', numeric: true },
  { key: 'sickDays', title: 'Больничный', numeric: true },
  { key: 'manualOverrides', title: 'Вручную', numeric: true, hint: 'Дни, изменённые вручную' },
]

const rows = computed(() => {
  const list = [...props.report.rows]
  const key = sortKey.value
  const direction = sortDir.value === 'asc' ? 1 : -1
  return list.sort((a, b) => {
    if (key === 'employeeName') {
      return a.employeeName.localeCompare(b.employeeName, 'ru') * direction
    }
    return ((a[key] as number) - (b[key] as number)) * direction
  })
})

function toggleSort(key: SortKey): void {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
    return
  }
  sortKey.value = key
  sortDir.value = key === 'employeeName' ? 'asc' : 'desc'
}
</script>

<template>
  <div class="space-y-3">
    <EmptyState
      v-if="report.rows.length === 0"
      icon="chart"
      title="Нет данных за выбранный период"
      description="Проверьте период и фильтры: возможно, у сотрудников не назначены шаблоны графиков."
    />

    <div
      v-else
      data-testid="reports-summary"
      class="sc-scroll overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
    >
      <table class="w-full min-w-[900px] border-collapse text-sm">
        <thead class="bg-slate-50 dark:bg-slate-950/40">
          <tr>
            <th
              v-for="column in columns"
              :key="column.key"
              class="border-b border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400"
              :class="column.numeric ? 'text-right' : 'text-left'"
              :title="column.hint"
            >
              <button
                type="button"
                class="inline-flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200"
                @click="toggleSort(column.key)"
              >
                {{ column.title }}
                <AppIcon
                  v-if="sortKey === column.key"
                  :name="sortDir === 'asc' ? 'chevronDown' : 'chevronDown'"
                  :size="12"
                  :class="sortDir === 'asc' ? 'rotate-180' : ''"
                />
              </button>
            </th>
          </tr>
        </thead>

        <tbody>
          <tr
            v-for="row in rows"
            :key="row.employeeId"
            class="hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
          >
            <td class="border-b border-slate-100 px-3 py-2 dark:border-slate-800">
              <div class="flex items-center gap-2">
                <span class="h-2.5 w-2.5 shrink-0 rounded-full" :style="{ backgroundColor: row.color }" />
                <span class="font-medium text-slate-800 dark:text-slate-100">{{ row.employeeName }}</span>
                <span v-if="!row.active" class="text-[11px] text-slate-400">(архив)</span>
              </div>
              <p class="pl-4 text-[11px] text-slate-400">
                {{ row.position || '—' }}<span v-if="row.department"> · {{ row.department }}</span>
              </p>
            </td>
            <td class="border-b border-slate-100 px-3 py-2 text-right font-medium text-slate-800 dark:border-slate-800 dark:text-slate-100">
              {{ row.workShifts }}
            </td>
            <td class="border-b border-slate-100 px-3 py-2 text-right text-slate-600 dark:border-slate-800 dark:text-slate-300">
              {{ row.dayShifts }}
            </td>
            <td class="border-b border-slate-100 px-3 py-2 text-right text-slate-600 dark:border-slate-800 dark:text-slate-300">
              {{ row.nightShifts }}
            </td>
            <td class="border-b border-slate-100 px-3 py-2 text-right text-slate-600 dark:border-slate-800 dark:text-slate-300">
              {{ row.fullShifts }}
            </td>
            <td class="border-b border-slate-100 px-3 py-2 text-right font-semibold text-slate-800 dark:border-slate-800 dark:text-slate-100">
              {{ row.hoursTotal }}
            </td>
            <td class="border-b border-slate-100 px-3 py-2 text-right text-slate-600 dark:border-slate-800 dark:text-slate-300">
              {{ row.offDays }}
            </td>
            <td class="border-b border-slate-100 px-3 py-2 text-right text-amber-600 dark:border-slate-800 dark:text-amber-400">
              {{ row.vacationDays }}
            </td>
            <td class="border-b border-slate-100 px-3 py-2 text-right text-red-600 dark:border-slate-800 dark:text-red-400">
              {{ row.sickDays }}
            </td>
            <td class="border-b border-slate-100 px-3 py-2 text-right text-blue-600 dark:border-slate-800 dark:text-blue-400">
              {{ row.manualOverrides }}
            </td>
          </tr>
        </tbody>

        <tfoot class="bg-slate-50 font-semibold dark:bg-slate-950/40">
          <tr>
            <td class="px-3 py-2 text-slate-700 dark:text-slate-200">
              Итого ({{ report.rows.length }} сотр. · {{ report.days }} дн.)
            </td>
            <td class="px-3 py-2 text-right text-slate-800 dark:text-slate-100">{{ report.totals.workShifts }}</td>
            <td class="px-3 py-2 text-right text-slate-600 dark:text-slate-300">
              {{ report.rows.reduce((sum, row) => sum + row.dayShifts, 0) }}
            </td>
            <td class="px-3 py-2 text-right text-slate-600 dark:text-slate-300">
              {{ report.rows.reduce((sum, row) => sum + row.nightShifts, 0) }}
            </td>
            <td class="px-3 py-2 text-right text-slate-600 dark:text-slate-300">
              {{ report.rows.reduce((sum, row) => sum + row.fullShifts, 0) }}
            </td>
            <td class="px-3 py-2 text-right text-slate-800 dark:text-slate-100">{{ report.totals.hoursTotal }}</td>
            <td class="px-3 py-2 text-right text-slate-600 dark:text-slate-300">{{ report.totals.offDays }}</td>
            <td class="px-3 py-2 text-right text-amber-600 dark:text-amber-400">{{ report.totals.vacationDays }}</td>
            <td class="px-3 py-2 text-right text-red-600 dark:text-red-400">{{ report.totals.sickDays }}</td>
            <td class="px-3 py-2 text-right text-blue-600 dark:text-blue-400">{{ report.totals.manualOverrides }}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  </div>
</template>
