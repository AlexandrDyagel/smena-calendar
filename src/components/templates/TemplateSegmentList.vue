<script setup lang="ts">
import { computed } from 'vue'
import type { ShiftTypeCode, TemplateSegment } from '@/types'
import { SHIFT_TYPE_LIST, createSegment, getShiftMeta } from '@/constants/shift-types'
import { withAlpha } from '@/utils/color'
import { pluralizeRu } from '@/utils/date'
import AppButton from '@/components/ui/AppButton.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import TemplateSegmentEditor from './TemplateSegmentEditor.vue'

const props = defineProps<{ segments: TemplateSegment[] }>()
const emit = defineEmits<{ 'update:segments': [segments: TemplateSegment[]] }>()

const totalHours = computed(() =>
  props.segments.reduce((sum, segment) => sum + (segment.hours || 0), 0),
)

const workDays = computed(
  () => props.segments.filter((segment) => getShiftMeta(segment.type).isWork).length,
)

function updateSegment(next: TemplateSegment): void {
  emit(
    'update:segments',
    props.segments.map((segment) => (segment.id === next.id ? next : segment)),
  )
}

function removeSegment(id: string): void {
  emit(
    'update:segments',
    props.segments.filter((segment) => segment.id !== id),
  )
}

function moveSegment(id: string, direction: -1 | 1): void {
  const index = props.segments.findIndex((segment) => segment.id === id)
  if (index === -1) return
  const target = index + direction
  if (target < 0 || target >= props.segments.length) return
  const next = [...props.segments]
  const [item] = next.splice(index, 1)
  if (!item) return
  next.splice(target, 0, item)
  emit('update:segments', next)
}

function addSegment(type: ShiftTypeCode): void {
  emit('update:segments', [...props.segments, createSegment(type)])
}

function duplicateLast(): void {
  const last = props.segments[props.segments.length - 1]
  if (!last) return
  emit('update:segments', [...props.segments, createSegment(last.type, { hours: last.hours })])
}

function clearAll(): void {
  emit('update:segments', [])
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-100">
        Цикл шаблона
        <span class="ml-1 font-normal text-slate-500 dark:text-slate-400">
          {{ segments.length }}
          {{ pluralizeRu(segments.length, ['день', 'дня', 'дней']) }} ·
          {{ workDays }} {{ pluralizeRu(workDays, ['смена', 'смены', 'смен']) }} ·
          {{ totalHours }} ч
        </span>
      </h3>

      <div class="flex items-center gap-2">
        <AppButton
          v-if="segments.length > 0"
          variant="ghost"
          size="sm"
          @click="duplicateLast"
        >
          <AppIcon name="copy" :size="14" />
          Дублировать последний
        </AppButton>
        <AppButton v-if="segments.length > 0" variant="ghost" size="sm" @click="clearAll">
          <AppIcon name="trash" :size="14" />
          Очистить цикл
        </AppButton>
      </div>
    </div>

    <!-- Визуальная цепочка цикла -->
    <div
      v-if="segments.length > 0"
      class="sc-scroll flex items-center gap-1 overflow-x-auto rounded-lg bg-slate-50 p-2 dark:bg-slate-950/40"
    >
      <template v-for="(segment, index) in segments" :key="`chain-${segment.id}`">
        <span
          v-if="index > 0"
          class="text-slate-300 dark:text-slate-600"
          aria-hidden="true"
        >
          →
        </span>
        <span
          class="flex h-8 min-w-8 items-center justify-center rounded-md border px-1.5 text-xs font-bold"
          :style="{
            backgroundColor: withAlpha(getShiftMeta(segment.type).color, 0.18),
            color: getShiftMeta(segment.type).color,
            borderColor: withAlpha(getShiftMeta(segment.type).color, 0.4),
          }"
          :title="`${index + 1}. ${getShiftMeta(segment.type).label}${segment.hours ? `, ${segment.hours} ч` : ''}`"
        >
          {{ getShiftMeta(segment.type).shortLabel }}
        </span>
      </template>
      <span class="ml-1 text-xs text-slate-400">↻ повтор</span>
    </div>

    <EmptyState
      v-if="segments.length === 0"
      compact
      icon="layers"
      title="Цикл пуст"
      description="Добавьте элементы цикла: рабочие смены и выходные. Цикл повторяется бесконечно с даты начала."
    />

    <ul v-else class="space-y-2">
      <TemplateSegmentEditor
        v-for="(segment, index) in segments"
        :key="segment.id"
        :segment="segment"
        :index="index"
        :total="segments.length"
        @update="updateSegment"
        @remove="removeSegment"
        @move="moveSegment"
      />
    </ul>

    <div class="rounded-xl border border-dashed border-slate-300 p-3 dark:border-slate-700">
      <p class="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
        Добавить элемент в конец цикла
      </p>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="meta in SHIFT_TYPE_LIST"
          :key="meta.code"
          type="button"
          class="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors"
          :style="{
            backgroundColor: withAlpha(meta.color, 0.12),
            color: meta.color,
            borderColor: withAlpha(meta.color, 0.35),
          }"
          :title="meta.description"
          @click="addSegment(meta.code)"
        >
          <AppIcon name="plus" :size="13" />
          {{ meta.label }}
        </button>
      </div>
    </div>
  </div>
</template>
