<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ISODate, ScheduleTemplate, TemplateSegment } from '@/types'
import { getShiftMeta } from '@/constants/shift-types'
import { previewTemplate } from '@/utils/schedule'
import { formatISO, weekdayIndexMondayFirst } from '@/utils/date'
import { withAlpha } from '@/utils/color'
import AppButton from '@/components/ui/AppButton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

const props = withDefaults(
  defineProps<{
    /** Шаблон целиком либо только сегменты (для конструктора). */
    template?: ScheduleTemplate | null
    segments?: TemplateSegment[]
    startDate: ISODate
    /** Количество дней предпросмотра. */
    days?: number
  }>(),
  { days: 14 },
)

const days = ref(props.days)
const options = [14, 30, 60]

/** Итоговый набор сегментов: из шаблона или переданный напрямую. */
const effectiveSegments = computed<TemplateSegment[]>(() =>
  props.template ? props.template.segments : (props.segments ?? []),
)

const workingTemplate = computed<ScheduleTemplate>(
  () =>
    props.template ?? {
      id: 'preview',
      name: 'Предпросмотр',
      description: '',
      segments: effectiveSegments.value,
      startDate: props.startDate,
      isPreset: false,
      createdAt: '',
      updatedAt: '',
    },
)

const preview = computed(() => previewTemplate(workingTemplate.value, props.startDate, days.value))

const totalHours = computed(() =>
  preview.value.reduce((sum, item) => sum + (item.segment?.hours ?? 0), 0),
)

const workDays = computed(
  () => preview.value.filter((item) => item.segment && getShiftMeta(item.segment.type).isWork).length,
)

/** Разбивка на недели для аккуратного отображения. */
const weeks = computed(() => {
  const result: Array<typeof preview.value> = []
  let current: typeof preview.value = []
  preview.value.forEach((item, index) => {
    if (index > 0 && weekdayIndexMondayFirst(item.date) === 0) {
      result.push(current)
      current = []
    }
    current.push(item)
  })
  if (current.length) result.push(current)
  return result
})
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-100">
        Предпросмотр
        <span class="ml-1 font-normal text-slate-500 dark:text-slate-400">
          {{ days }} дней · {{ workDays }} смен · {{ totalHours }} ч
        </span>
      </h3>

      <div class="flex items-center gap-1">
        <AppButton
          v-for="option in options"
          :key="option"
          size="sm"
          :variant="days === option ? 'primary' : 'ghost'"
          @click="days = option"
        >
          {{ option }} дней
        </AppButton>
      </div>
    </div>

    <EmptyState
      v-if="effectiveSegments.length === 0"
      compact
      icon="layers"
      title="Нет данных для предпросмотра"
      description="Добавьте хотя бы один элемент цикла."
    />

    <div v-else class="space-y-2">
      <div
        v-for="(week, index) in weeks"
        :key="`week-${index}`"
        class="flex flex-wrap items-center gap-1"
      >
        <span class="mr-1 w-14 shrink-0 text-[10px] text-slate-400">
          нед. {{ index + 1 }}
        </span>

        <div
          v-for="item in week"
          :key="item.date"
          class="flex min-w-[54px] flex-1 flex-col items-center rounded-lg border px-1 py-1.5"
          :style="{
            backgroundColor: item.segment
              ? withAlpha(getShiftMeta(item.segment.type).color, 0.14)
              : undefined,
            borderColor: item.segment
              ? withAlpha(getShiftMeta(item.segment.type).color, 0.35)
              : undefined,
          }"
          :title="`${formatISO(item.date)} — ${item.segment ? getShiftMeta(item.segment.type).label : 'нет данных'}`"
        >
          <span class="text-[10px] text-slate-500 dark:text-slate-400">
            {{ formatISO(item.date, 'D') }}
          </span>
          <span
            class="text-xs font-semibold"
            :style="{ color: item.segment ? getShiftMeta(item.segment.type).color : '#94a3b8' }"
          >
            {{ item.segment ? getShiftMeta(item.segment.type).shortLabel : '—' }}
          </span>
          <span class="text-[9px] text-slate-400">
            {{ item.segment?.hours ? `${item.segment.hours}ч` : '' }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
