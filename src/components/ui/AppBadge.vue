<script setup lang="ts">
import { computed } from 'vue'
import { textOn, withAlpha } from '@/utils/color'

const props = withDefaults(
  defineProps<{
    label: string
    color?: string
    /** Вариант отображения: плотный цветной или приглушённый с обводкой. */
    variant?: 'solid' | 'soft' | 'outline'
    size?: 'sm' | 'md'
    title?: string
  }>(),
  { variant: 'soft', size: 'md' },
)

const styles = computed(() => {
  const color = props.color
  if (!color) return {}
  if (props.variant === 'solid') {
    return { backgroundColor: color, color: textOn(color), borderColor: color }
  }
  if (props.variant === 'outline') {
    return { borderColor: color, color, backgroundColor: 'transparent' }
  }
  return { backgroundColor: withAlpha(color, 0.16), color, borderColor: withAlpha(color, 0.35) }
})

const classes = computed(() => [
  'inline-flex items-center gap-1 rounded-md border font-medium whitespace-nowrap',
  props.size === 'sm' ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-0.5 text-xs',
  props.color ? '' : 'border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300',
])
</script>

<template>
  <span :class="classes" :style="styles" :title="title">
    <slot>{{ label }}</slot>
  </span>
</template>
