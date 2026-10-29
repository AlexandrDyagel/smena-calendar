<script setup lang="ts">
import { computed } from 'vue'
import { getShiftMeta } from '@/constants/shift-types'
import { getMonthGrid, WEEKDAYS_RU_SHORT, formatDateHuman, isoWeekNumber, isToday, todayISO } from '@/utils/date'
import { withAlpha } from '@/utils/color'
import { useEmployeeSchedule } from '@/composables/useEmployeeSchedule'
import { useUiStore } from '@/stores/ui'
import { useTemplatesStore } from '@/stores/templates'
import AppButton from '@/components/ui/AppButton.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

const props = defineProps<{ employeeId: string }>()

const ui = useUiStore()
const templatesStore = useTemplatesStore()

const { employee, monthAnchor, monthTitle, cells, counts, hours, manualCount, assignments, overrides, conflicts, activeAssignment, upcomingAssignment, hasAssignments, nextMonth, previousMonth, currentMonth, showStartMonth } =
  useEmployeeSchedule(() => props.employeeId)

const cellsByDate = computed(() => {
  const map = new Map<string, (typeof cells.value)[number]>()
  for (const cell of cells.value) map.set(cell.date, cell)
  return map
})

const grid = computed(() => getMonthGrid(monthAnchor.value, ui.weekStartsOn))

/** Последнее завершённое назначение — объясняет пустой календарь, когда график закончился. */
const finishedAssignment = computed<{ templateId: string; endDate: string } | null>(() => {
  const today = todayISO()
  const finished = assignments.value
    .filter((assignment) => Boolean(assignment.endDate) && (assignment.endDate as string) < today)
    .sort((a, b) => (a.endDate as string).localeCompare(b.endDate as string))
  const last = finished[finished.length - 1]
  if (!last || !last.endDate) return null
  return { templateId: last.templateId, endDate: last.endDate }
})

const weekdayHeaders = computed(() => {
  const base = WEEKDAYS_RU_SHORT
  return ui.weekStartsOn === 7 ? [base[6]!, ...base.slice(0, 6)] : base
})

const summary = computed(() => [
  { label: 'Рабочих смен', value: counts.value.DAY + counts.value.NIGHT + counts.value.FULL + counts.value.CUSTOM },
  { label: 'Дневных', value: counts.value.DAY },
  { label: 'Ночных', value: counts.value.NIGHT },
  { label: 'Суточных', value: counts.value.FULL },
  { label: 'Выходных', value: counts.value.OFF },
  { label: 'Отпуск', value: counts.value.VACATION },
  { label: 'Больничный', value: counts.value.SICK },
  { label: 'Часов', value: hours.value },
])

function shiftStyle(date: string) {
  const cell = cellsByDate.value.get(date)
  if (!cell?.type) return {}
  const meta = getShiftMeta(cell.type)
  return {
    backgroundColor: withAlpha(meta.color, 0.16),
    color: meta.color,
    borderColor: withAlpha(meta.color, 0.4),
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center gap-2">
      <h3 class="text-sm font-semibold capitalize text-slate-800 dark:text-slate-100">
        {{ monthTitle }}
      </h3>
      <div class="ml-auto flex items-center gap-1">
        <AppButton size="sm" variant="secondary" aria-label="Предыдущий месяц" @click="previousMonth()">
          <AppIcon name="chevronLeft" :size="15" />
        </AppButton>
        <AppButton size="sm" variant="secondary" @click="currentMonth()">Текущий месяц</AppButton>
        <AppButton size="sm" variant="secondary" aria-label="Следующий месяц" @click="nextMonth()">
          <AppIcon name="chevronRight" :size="15" />
        </AppButton>
      </div>
    </div>

    <div v-if="!employee" class="text-sm text-slate-500 dark:text-slate-400">
      Работник не найден
    </div>

    <template v-else>
      <!-- Состояние графика: важно отличать «нет шаблона» от «шаблон начнётся позже» -->
      <div
        v-if="upcomingAssignment && !activeAssignment"
        class="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200"
      >
        <p class="flex items-center gap-1.5 font-medium">
          <AppIcon name="calendar" :size="14" />
          График «{{ templatesStore.nameOf(upcomingAssignment.templateId) }}» начнётся
          {{ formatDateHuman(upcomingAssignment.startDate) }}
        </p>
        <p class="mt-1">
          До этой даты смены не размечены — это нормально, шаблон уже назначен.
          Календарь открыт на месяце начала графика.
        </p>
        <div class="mt-2 flex flex-wrap items-center gap-2">
          <AppButton size="sm" variant="secondary" @click="showStartMonth()">
            Показать месяц начала
          </AppButton>
          <AppButton size="sm" variant="ghost" @click="currentMonth()">Текущий месяц</AppButton>
        </div>
      </div>

      <p
        v-else-if="activeAssignment"
        class="text-xs text-slate-500 dark:text-slate-400"
      >
        Действующий график:
        <strong class="text-slate-700 dark:text-slate-200">
          {{ templatesStore.nameOf(activeAssignment.templateId) }}
        </strong>
        с {{ formatDateHuman(activeAssignment.startDate) }}
        <span v-if="activeAssignment.endDate">
          по {{ formatDateHuman(activeAssignment.endDate) }}
        </span>
      </p>

      <p
        v-else-if="finishedAssignment"
        class="rounded-lg bg-slate-100 p-2.5 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300"
      >
        График не действует: назначение
        «{{ templatesStore.nameOf(finishedAssignment.templateId) }}» закончилось
        {{ formatDateHuman(finishedAssignment.endDate) }}. Назначьте новый шаблон, чтобы заполнить
        календарь.
      </p>

      <p
        v-else-if="!hasAssignments"
        class="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
      >
        Шаблон графика не назначен — нажмите «Назначить шаблон», чтобы календарь заполнился
        автоматически.
      </p>

      <div v-if="conflicts.length > 0" class="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
        <p class="flex items-center gap-1.5 font-medium">
          <AppIcon name="alert" :size="14" />
          Пересекающиеся назначения: {{ conflicts.length }}
        </p>
        <p class="mt-1">
          В расчёте используется последнее начавшееся назначение. Рекомендуется закрыть лишние
          периоды в истории назначений.
        </p>
      </div>

      <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div
          v-for="item in summary"
          :key="item.label"
          class="rounded-lg border border-slate-200 px-2.5 py-2 dark:border-slate-800"
        >
          <p class="text-[11px] text-slate-400">{{ item.label }}</p>
          <p class="text-sm font-semibold text-slate-800 dark:text-slate-100">{{ item.value }}</p>
        </div>
      </div>

      <p v-if="manualCount > 0" class="text-xs text-blue-600 dark:text-blue-400">
        Изменено вручную: {{ manualCount }} дн.
      </p>

      <div class="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
        <div class="grid grid-cols-7 bg-slate-50 dark:bg-slate-950/40">
          <div
            v-for="(header, index) in weekdayHeaders"
            :key="header"
            class="px-1 py-1.5 text-center text-[11px] font-semibold uppercase"
            :class="index >= 5 ? 'text-rose-500' : 'text-slate-400'"
          >
            {{ header }}
          </div>
        </div>

        <div class="grid grid-cols-7">
          <div
            v-for="date in grid"
            :key="date"
            class="min-h-[52px] border-b border-r border-slate-100 p-1 text-center dark:border-slate-800"
            :class="[
              date.slice(0, 7) === monthAnchor.slice(0, 7)
                ? 'bg-white dark:bg-slate-900'
                : 'bg-slate-50/60 text-slate-400 dark:bg-slate-950/30',
              isToday(date) ? 'ring-2 ring-inset ring-blue-500' : '',
            ]"
            :title="`${formatDateHuman(date)} — ${cellsByDate.get(date)?.type ? getShiftMeta(cellsByDate.get(date)!.type!).label : 'нет данных'}`"
          >
            <div class="flex items-center justify-between px-0.5">
              <span class="text-[10px] text-slate-400">{{ Number(date.slice(8, 10)) }}</span>
              <span v-if="ui.showWeekNumbers && date.slice(8, 10) === '01'" class="text-[9px] text-slate-300">
                {{ isoWeekNumber(date) }}
              </span>
            </div>
            <span
              v-if="cellsByDate.get(date)?.type"
              class="mt-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded border px-1 text-[10px] font-bold"
              :style="shiftStyle(date)"
            >
              {{ getShiftMeta(cellsByDate.get(date)!.type!).shortLabel }}
            </span>
          </div>
        </div>
      </div>

      <div class="grid gap-3 lg:grid-cols-2">
        <section>
          <h4 class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            История назначений
          </h4>
          <EmptyState
            v-if="assignments.length === 0"
            compact
            icon="layers"
            title="Шаблон не назначен"
            description="Назначьте шаблон графика, чтобы календарь заполнился автоматически."
          />
          <ul v-else class="space-y-1.5">
            <li
              v-for="assignment in assignments"
              :key="assignment.id"
              class="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs dark:border-slate-800"
            >
              <span class="font-medium text-slate-700 dark:text-slate-200">
                {{ templatesStore.nameOf(assignment.templateId) }}
              </span>
              <span class="ml-1 text-slate-500 dark:text-slate-400">
                {{ formatDateHuman(assignment.startDate) }} —
                {{ assignment.endDate ? formatDateHuman(assignment.endDate) : 'бессрочно' }}
              </span>
            </li>
          </ul>
        </section>

        <section>
          <h4 class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Ручные изменения ({{ overrides.length }})
          </h4>
          <p v-if="overrides.length === 0" class="text-xs text-slate-400">
            Переопределений нет — все дни рассчитаны по шаблону.
          </p>
          <ul v-else class="sc-scroll max-h-40 space-y-1.5 overflow-y-auto pr-1">
            <li
              v-for="override in overrides"
              :key="override.id"
              class="flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs dark:border-slate-800"
            >
              <span class="font-medium text-slate-700 dark:text-slate-200">
                {{ formatDateHuman(override.date) }}
              </span>
              <span :style="{ color: getShiftMeta(override.type).color }">
                {{ getShiftMeta(override.type).label }}
              </span>
              <span v-if="override.reason" class="truncate text-slate-500 dark:text-slate-400">
                · {{ override.reason }}
              </span>
            </li>
          </ul>
        </section>
      </div>
    </template>
  </div>
</template>
