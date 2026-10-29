<script setup lang="ts">
import { computed } from 'vue'
import { useUiStore } from '@/stores/ui'
import { useCalendar } from '@/composables/useCalendar'
import { formatISO, getWeekDates, isoWeekNumber } from '@/utils/date'
import { shortName } from '@/utils/employee'
import ShiftBadge from './ShiftBadge.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

const ui = useUiStore()
const { visibleEmployees, cellFor, metaFor } = useCalendar()

const dates = computed(() => getWeekDates(ui.anchorDate, ui.weekStartsOn))
</script>

<template>
  <div class="space-y-3">
    <EmptyState
      v-if="visibleEmployees.length === 0"
      title="Нет сотрудников для отображения"
      description="Измените фильтры или добавьте работников в разделе «Работники»."
      icon="users"
    />

    <div
      v-else
      class="sc-scroll overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
    >
      <table class="w-full min-w-[860px] border-collapse">
        <thead>
          <tr class="bg-slate-50 dark:bg-slate-950/40">
            <th
              class="sticky left-0 z-10 w-52 border-b border-r border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400"
            >
              Сотрудник
            </th>
            <th
              v-for="date in dates"
              :key="date"
              class="border-b border-r border-slate-200 px-2 py-2 text-center text-xs dark:border-slate-800"
              :class="
                metaFor(date).isToday
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300'
                  : 'text-slate-600 dark:text-slate-300'
              "
            >
              <div class="font-semibold">{{ formatISO(date, 'D MMMM') }}</div>
              <div class="text-[11px] capitalize text-slate-400">
                {{ formatISO(date, 'dddd') }}
                <span v-if="ui.showWeekNumbers">· нед. {{ isoWeekNumber(date) }}</span>
              </div>
            </th>
          </tr>
        </thead>

        <tbody>
          <tr
            v-for="employee in visibleEmployees"
            :key="employee.id"
            class="hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
          >
            <th
              class="sticky left-0 z-10 border-b border-r border-slate-200 bg-white px-3 py-2 text-left text-xs font-medium text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
            >
              <span class="flex items-center gap-2">
                <span class="h-2.5 w-2.5 rounded-full" :style="{ backgroundColor: employee.color }" />
                <span class="truncate">{{ shortName(employee) }}</span>
              </span>
            </th>

            <td
              v-for="date in dates"
              :key="`${employee.id}-${date}`"
              class="cursor-pointer border-b border-r border-slate-200 px-1.5 py-2 text-center dark:border-slate-800"
              :class="metaFor(date).isDayOff ? 'bg-rose-50/50 dark:bg-rose-500/5' : ''"
              @click="ui.openDay(date)"
            >
              <ShiftBadge
                :type="cellFor(employee.id, date)?.type ?? null"
                :hours="cellFor(employee.id, date)?.hours"
                :source="cellFor(employee.id, date)?.source"
                size="xs"
                show-hours
                :muted="!metaFor(date).isCurrentMonth"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
