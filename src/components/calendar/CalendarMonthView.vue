<script setup lang="ts">
import { computed } from 'vue'
import type { ISODate } from '@/types'
import { isoWeekNumber } from '@/utils/date'
import { useUiStore } from '@/stores/ui'
import { useCalendar } from '@/composables/useCalendar'
import { shortName } from '@/utils/employee'
import CalendarDayCell from './CalendarDayCell.vue'

const ui = useUiStore()
const {
  visibleEmployees,
  monthWeeks,
  weekdayHeaders,
  cellsFor,
  statsFor,
  metaFor,
  employeesInConflict,
} = useCalendar()

/** Плашки сотрудников нужно подписывать коротко: «Иванов И.». */
const employeeNames = computed(() => {
  const map = new Map<string, string>()
  for (const employee of visibleEmployees.value) {
    map.set(employee.id, shortName(employee))
  }
  return map
})

function employeeNameFor(employeeId: string): string {
  return employeeNames.value.get(employeeId) ?? 'Работник удалён'
}

function weekNumberFor(date: ISODate): number | null {
  return ui.showWeekNumbers ? isoWeekNumber(date) : null
}
</script>

<template>
  <div class="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
    <div class="sc-calendar-grid border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40">
      <div
        v-for="(header, index) in weekdayHeaders"
        :key="header"
        class="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide"
        :class="
          index >= 5
            ? 'text-rose-500 dark:text-rose-400'
            : 'text-slate-500 dark:text-slate-400'
        "
      >
        {{ header }}
      </div>
    </div>

    <div
      v-for="(week, weekIndex) in monthWeeks"
      :key="weekIndex"
      class="sc-calendar-grid"
    >
      <CalendarDayCell
        v-for="(date, dayIndex) in week"
        :key="date"
        :date="date"
        :cells="cellsFor(date)"
        :meta="metaFor(date)"
        :stats="statsFor(date)"
        :employee-name-for="employeeNameFor"
        :week-number="dayIndex === 0 ? weekNumberFor(date) : null"
        :show-week-number="ui.showWeekNumbers"
        :max-badges="4"
        @open="ui.openDay($event)"
      />
    </div>

    <div
      v-if="visibleEmployees.some((employee) => employeesInConflict.has(employee.id))"
      class="flex items-center gap-2 border-t border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
    >
      У некоторых сотрудников пересекаются назначения шаблонов — в календаре показывается
      последнее начавшееся назначение. Проверьте раздел «Работники».
    </div>
  </div>
</template>
