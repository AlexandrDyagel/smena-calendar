<script setup lang="ts">
import { computed } from 'vue'
import { useUiStore } from '@/stores/ui'
import { useCalendar } from '@/composables/useCalendar'
import { useCellPresenter } from '@/composables/useCellPresenter'
import { formatISO } from '@/utils/date'
import ShiftBadge from './ShiftBadge.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import AppIcon from '@/components/ui/AppIcon.vue'

const ui = useUiStore()
const { visibleCells, metaFor, visibleEmployees } = useCalendar()
const { employeeLabel, templateLabel, sourceLabel } = useCellPresenter()

/** Строки списка, сгруппированные по датам в порядке возрастания. */
const rows = computed(() =>
  [...visibleCells.value].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1
    return a.employeeId.localeCompare(b.employeeId)
  }),
)

const grouped = computed(() => {
  const map = new Map<string, typeof rows.value>()
  for (const row of rows.value) {
    const bucket = map.get(row.date)
    if (bucket) bucket.push(row)
    else map.set(row.date, [row])
  }
  return [...map.entries()]
})
</script>

<template>
  <div class="space-y-3">
    <EmptyState
      v-if="visibleEmployees.length === 0"
      title="Нет сотрудников для отображения"
      description="Измените фильтры или добавьте работников в разделе «Работники»."
      icon="users"
    />

    <EmptyState
      v-else-if="grouped.length === 0"
      title="Нет смен за выбранный период"
      description="Проверьте фильтры или назначьте шаблоны графика сотрудникам."
      icon="calendar"
    />

    <div
      v-else
      class="sc-scroll max-h-[70vh] overflow-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
    >
      <table class="w-full min-w-[760px] border-collapse text-sm">
        <thead class="sticky top-0 z-10 bg-slate-50 dark:bg-slate-950/60">
          <tr class="text-left text-xs uppercase text-slate-500 dark:text-slate-400">
            <th class="border-b border-slate-200 px-3 py-2 dark:border-slate-800">Дата</th>
            <th class="border-b border-slate-200 px-3 py-2 dark:border-slate-800">Сотрудник</th>
            <th class="border-b border-slate-200 px-3 py-2 dark:border-slate-800">Смена</th>
            <th class="border-b border-slate-200 px-3 py-2 dark:border-slate-800">Часы</th>
            <th class="border-b border-slate-200 px-3 py-2 dark:border-slate-800">Источник</th>
            <th class="border-b border-slate-200 px-3 py-2 dark:border-slate-800">Шаблон</th>
            <th class="border-b border-slate-200 px-3 py-2 dark:border-slate-800">Комментарий</th>
          </tr>
        </thead>

        <tbody>
          <template v-for="[date, items] in grouped" :key="date">
            <tr class="bg-slate-50/80 dark:bg-slate-950/30">
              <td colspan="7" class="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                {{ formatISO(date, 'D MMMM YYYY, dddd') }}
                <span v-if="metaFor(date).holidayName" class="ml-2 font-normal text-rose-500">
                  {{ metaFor(date).holidayName }}
                </span>
              </td>
            </tr>

            <tr
              v-for="cell in items"
              :key="`${cell.employeeId}-${cell.date}`"
              class="cursor-pointer hover:bg-blue-50/50 dark:hover:bg-blue-500/5"
              @click="ui.openDay(cell.date)"
            >
              <td class="border-b border-slate-100 px-3 py-2 text-xs text-slate-400 dark:border-slate-800">
                <AppIcon name="calendar" :size="13" class="inline" />
              </td>
              <td class="border-b border-slate-100 px-3 py-2 text-slate-700 dark:border-slate-800 dark:text-slate-200">
                {{ employeeLabel(cell) }}
              </td>
              <td class="border-b border-slate-100 px-3 py-2 dark:border-slate-800">
                <ShiftBadge :type="cell.type" :hours="cell.hours" :source="cell.source" size="xs" show-hours />
              </td>
              <td class="border-b border-slate-100 px-3 py-2 text-slate-600 dark:border-slate-800 dark:text-slate-300">
                {{ cell.hours || '—' }}
              </td>
              <td class="border-b border-slate-100 px-3 py-2 text-xs dark:border-slate-800">
                <span
                  :class="
                    cell.source === 'override'
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-slate-500 dark:text-slate-400'
                  "
                >
                  {{ sourceLabel(cell) }}
                </span>
              </td>
              <td class="border-b border-slate-100 px-3 py-2 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                {{ templateLabel(cell) }}
              </td>
              <td class="max-w-[220px] border-b border-slate-100 px-3 py-2 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <span class="line-clamp-2">{{ cell.reason || cell.note || '—' }}</span>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>
