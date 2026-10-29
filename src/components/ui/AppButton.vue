<script setup lang="ts">
import { computed } from 'vue'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'quiet'
type Size = 'sm' | 'md' | 'lg'

const props = withDefaults(
  defineProps<{
    variant?: Variant
    size?: Size
    type?: 'button' | 'submit' | 'reset'
    disabled?: boolean
    loading?: boolean
    block?: boolean
    title?: string
    ariaLabel?: string
  }>(),
  { variant: 'secondary', size: 'md', type: 'button' },
)

const emit = defineEmits<{ click: [event: MouseEvent] }>()

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-blue-600 text-white hover:bg-blue-700 focus-visible:outline-blue-600 border border-transparent',
  secondary:
    'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600 dark:hover:bg-slate-700',
  ghost:
    'bg-transparent text-slate-600 border border-transparent hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
  quiet:
    'bg-slate-100 text-slate-700 border border-transparent hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700',
  danger:
    'bg-red-600 text-white hover:bg-red-700 border border-transparent focus-visible:outline-red-600',
  success:
    'bg-emerald-600 text-white hover:bg-emerald-700 border border-transparent focus-visible:outline-emerald-600',
}

const SIZES: Record<Size, string> = {
  sm: 'px-2.5 py-1.5 text-xs gap-1.5',
  md: 'px-3.5 py-2 text-sm gap-2',
  lg: 'px-5 py-2.5 text-base gap-2',
}

const classes = computed(() => [
  'inline-flex items-center justify-center rounded-lg font-medium transition-colors',
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
  'disabled:cursor-not-allowed disabled:opacity-50',
  VARIANTS[props.variant],
  SIZES[props.size],
  props.block ? 'w-full' : '',
])

function onClick(event: MouseEvent): void {
  if (props.disabled || props.loading) {
    event.preventDefault()
    event.stopPropagation()
    return
  }
  emit('click', event)
}
</script>

<template>
  <button
    :type="type"
    :class="classes"
    :disabled="disabled || loading"
    :title="title"
    :aria-label="ariaLabel"
    @click="onClick"
  >
    <span
      v-if="loading"
      class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
      aria-hidden="true"
    />
    <slot />
  </button>
</template>
