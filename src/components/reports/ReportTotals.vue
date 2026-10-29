<script setup lang="ts">
import { computed } from 'vue'
import type { ReportResult } from '@/types'
import AppIcon from '@/components/ui/AppIcon.vue'

const props = defineProps<{ report: ReportResult }>()

const cards = computed(() => [
  {
    label: 'Рабочих смен',
    value: props.report.totals.workShifts,
    icon: 'clock',
    accent: 'text-emerald-600 dark:text-emerald-400',
  },
  {
    label: 'Часов всего',
    value: props.report.totals.hoursTotal,
    icon: 'chart',
    accent: 'text-blue-600 dark:text-blue-400',
  },
  {
    label: 'Выходных по графику',
    value: props.report.totals.offDays,
    icon: 'calendar',
    accent: 'text-slate-500 dark:text-slate-400',
  },
  {
    label: 'Отпуск / больничный',
    value: `${props.report.totals.vacationDays} / ${props.report.totals.sickDays}`,
    icon: 'info',
    accent: 'text-amber-600 dark:text-amber-400',
  },
  {
    label: 'Изменено вручную',
    value: props.report.totals.manualOverrides,
    icon: 'pencil',
    accent: 'text-violet-600 dark:text-violet-400',
  },
  {
    label: 'Дней в периоде',
    value: props.report.days,
    icon: 'calendar',
    accent: 'text-slate-500 dark:text-slate-400',
  },
])
</script>

<template>
  <div class="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
    <div
      v-for="card in cards"
      :key="card.label"
      class="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
    >
      <div class="flex items-center gap-2">
        <AppIcon :name="card.icon" :size="16" :class="card.accent" />
        <span class="text-[11px] uppercase tracking-wide text-slate-400">{{ card.label }}</span>
      </div>
      <p class="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">{{ card.value }}</p>
    </div>
  </div>
</template>
