<script setup lang="ts">
import { computed } from 'vue'
import type { CalendarCell, ISODate } from '@/types'
import type { DayMeta, DayStats } from '@/composables/useCalendar'
import { getShiftMeta } from '@/constants/shift-types'
import { formatISO } from '@/utils/date'
import ShiftBadge from './ShiftBadge.vue'
import AppIcon from '@/components/ui/AppIcon.vue'

const props = withDefaults(
  defineProps<{
    date: ISODate
    cells: CalendarCell[]
    meta: DayMeta
    stats: DayStats
    employeeNameFor: (employeeId: string) => string
    maxBadges?: number
    weekNumber?: number | null
    showWeekNumber?: boolean
  }>(),
  { maxBadges: 3 },
)

const emit = defineEmits<{ open: [date: ISODate] }>()

const visibleCells = computed(() => props.cells.slice(0, props.maxBadges))
const hiddenCount = computed(() => Math.max(0, props.cells.length - props.maxBadges))

const dayNumber = computed(() => Number(props.date.slice(8, 10)))

/** Название типа смены на русском (для подсказок и подписей). */
function shiftTitle(cell: CalendarCell): string {
  return cell.type ? getShiftMeta(cell.type).label : 'не размечено'
}

const cellClasses = computed(() => [
  'group relative flex min-h-[116px] cursor-pointer flex-col gap-1 border-b border-r border-slate-200 p-1.5 text-left transition-colors dark:border-slate-800',
  props.meta.isCurrentMonth
    ? 'bg-white dark:bg-slate-900'
    : 'bg-slate-50/70 dark:bg-slate-950/50',
  props.meta.isDayOff && props.meta.isCurrentMonth ? 'bg-rose-50/70 dark:bg-rose-500/5' : '',
  !props.meta.isCurrentMonth && props.meta.isDayOff ? 'bg-rose-50/40 dark:bg-rose-500/5' : '',
  props.meta.isToday ? 'ring-2 ring-inset ring-blue-500' : '',
  'hover:bg-blue-50/60 dark:hover:bg-blue-500/10',
])
</script>

<template>
  <button type="button" :class="cellClasses" :data-date="date" @click="emit('open', date)">
    <header class="flex items-start justify-between gap-1">
      <span class="flex items-center gap-1">
        <span
          class="flex h-6 min-w-6 items-center justify-center rounded-md px-1 text-xs font-semibold"
          :class="
            meta.isToday
              ? 'bg-blue-600 text-white'
              : meta.isCurrentMonth
                ? 'text-slate-700 dark:text-slate-200'
                : 'text-slate-400 dark:text-slate-500'
          "
        >
          {{ dayNumber }}
        </span>
        <span
          v-if="showWeekNumber && weekNumber"
          class="text-[10px] text-slate-400 dark:text-slate-500"
          :title="`Неделя №${weekNumber}`"
        >
          нед.{{ weekNumber }}
        </span>
      </span>

      <span class="flex items-center gap-0.5">
        <AppIcon
          v-if="meta.isHoliday"
          name="star"
          :size="12"
          class="text-rose-500"
          :title="meta.holidayName ?? 'Праздник'"
        />
        <span
          v-if="stats.unassigned > 0 && cells.length > 0"
          class="text-[10px] text-slate-400"
          title="Есть сотрудники без назначенного шаблона"
        >
          ?
        </span>
      </span>
    </header>

    <div class="flex flex-1 flex-col gap-0.5">
      <ShiftBadge
        v-for="cell in visibleCells"
        :key="`${cell.employeeId}-${cell.date}`"
        :type="cell.type"
        :hours="cell.hours"
        :source="cell.source"
        :employee-name="employeeNameFor(cell.employeeId)"
        show-employee
        size="xs"
        :title="`${employeeNameFor(cell.employeeId)} · ${shiftTitle(cell)}`"
      />

      <span v-if="hiddenCount > 0" class="text-[10px] text-slate-500 dark:text-slate-400">
        +{{ hiddenCount }} ещё
      </span>
    </div>

    <footer
      v-if="cells.length > 0"
      class="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400"
    >
      <span v-if="stats.work" class="flex items-center gap-0.5">
        <AppIcon name="clock" :size="11" />
        {{ stats.hours }} ч
      </span>
      <span v-if="stats.vacation" class="text-amber-600 dark:text-amber-400">
        отпуск {{ stats.vacation }}
      </span>
      <span v-if="stats.sick" class="text-red-600 dark:text-red-400">больничный {{ stats.sick }}</span>
    </footer>

    <!-- Подсказка при наведении -->
    <div
      class="pointer-events-none absolute left-1/2 top-full z-30 hidden w-64 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-2 text-left text-xs shadow-xl group-hover:block dark:border-slate-700 dark:bg-slate-900"
    >
      <p class="mb-1 font-semibold text-slate-700 dark:text-slate-200">
        {{ formatISO(date) }}
        <span v-if="meta.holidayName" class="font-normal text-rose-500">
          · {{ meta.holidayName }}
        </span>
      </p>
      <ul v-if="cells.length" class="space-y-0.5 text-slate-600 dark:text-slate-300">
        <li v-for="cell in cells" :key="`tip-${cell.employeeId}`" class="truncate">
          {{ employeeNameFor(cell.employeeId) }} — {{ shiftTitle(cell) }}
          <span v-if="cell.hours">, {{ cell.hours }} ч</span>
          <span v-if="cell.source === 'override'" class="text-blue-600 dark:text-blue-400">
            (вручную)
          </span>
        </li>
      </ul>
      <p v-else class="text-slate-400">Нет смен по выбранным фильтрам</p>
      <p class="mt-1 text-[10px] text-slate-400">Нажмите, чтобы открыть детали дня</p>
    </div>
  </button>
</template>
