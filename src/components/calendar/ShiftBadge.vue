<script setup lang="ts">
import { computed } from 'vue'
import type { CalendarCellSource, ShiftTypeCode } from '@/types'
import { getShiftMeta } from '@/constants/shift-types'
import { shade, withAlpha } from '@/utils/color'
import AppIcon from '@/components/ui/AppIcon.vue'

const props = withDefaults(
  defineProps<{
    type: ShiftTypeCode | null
    /** Имя работника — выводится в начале плашки, если включено. */
    employeeName?: string
    hours?: number
    /** Источник: ручное переопределение помечается отдельно. */
    source?: CalendarCellSource
    size?: 'xs' | 'sm' | 'md'
    showEmployee?: boolean
    showHours?: boolean
    /** Заголовок подсказки. */
    title?: string
    muted?: boolean
  }>(),
  { size: 'sm' },
)

const meta = computed(() => (props.type ? getShiftMeta(props.type) : null))

const isManual = computed(() => props.source === 'override')

const styles = computed(() => {
  if (!meta.value) {
    return {
      backgroundColor: 'transparent',
      color: '#94a3b8',
      borderColor: '#cbd5e1',
      borderStyle: 'dashed',
    }
  }
  const color = meta.value.color
  return {
    backgroundColor: withAlpha(color, props.muted ? 0.1 : 0.16),
    color: shade(color, -0.25),
    borderColor: isManual.value ? shade(color, -0.15) : withAlpha(color, 0.32),
    borderStyle: 'solid',
  }
})

const sizeClasses = computed(() => {
  switch (props.size) {
    case 'xs':
      return 'px-1.5 py-0.5 text-[10px] gap-1'
    case 'md':
      return 'px-2.5 py-1 text-sm gap-2'
    default:
      return 'px-2 py-0.5 text-xs gap-1.5'
  }
})

const hoursLabel = computed(() => {
  if (props.hours === undefined || props.hours === null) return ''
  if (!props.hours) return ''
  return `${props.hours} ч`
})
</script>

<template>
  <span
    class="inline-flex max-w-full items-center rounded-md border font-medium"
    :class="[
      sizeClasses,
      isManual ? 'ring-1 ring-inset ring-current/30' : '',
      muted ? 'opacity-70' : '',
    ]"
    :style="styles"
    :title="title"
  >
    <AppIcon v-if="isManual" name="pencil" :size="11" class="shrink-0 opacity-80" />
    <span v-if="showEmployee && employeeName" class="truncate font-semibold">
      {{ employeeName }}
    </span>
    <span class="truncate">
      {{ meta ? meta.shortLabel : '—' }}
    </span>
    <span v-if="showHours && hoursLabel" class="shrink-0 opacity-75">{{ hoursLabel }}</span>
  </span>
</template>
