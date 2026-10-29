<script setup lang="ts">
import { computed, useId } from 'vue'

const props = withDefaults(
  defineProps<{
    label?: string
    type?: string
    placeholder?: string
    hint?: string
    error?: string
    required?: boolean
    disabled?: boolean
    min?: string | number
    max?: string | number
    step?: string | number
    autofocus?: boolean
    inputmode?: 'text' | 'numeric' | 'decimal' | 'search' | 'email' | 'tel' | 'url'
  }>(),
  { type: 'text' },
)

const model = defineModel<string | number | undefined>({ default: '' })

const fieldId = useId()

const inputClasses = computed(() => [
  'w-full rounded-lg border px-3 py-2 text-sm transition-colors',
  'bg-white text-slate-900 placeholder:text-slate-400',
  'dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500',
  'focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500',
  'disabled:cursor-not-allowed disabled:bg-slate-100 dark:disabled:bg-slate-800',
  props.error
    ? 'border-red-400 dark:border-red-500'
    : 'border-slate-300 dark:border-slate-600',
])
</script>

<template>
  <div class="flex flex-col gap-1">
    <label
      v-if="label"
      :for="fieldId"
      class="text-xs font-medium text-slate-600 dark:text-slate-300"
    >
      {{ label }}
      <span v-if="required" class="text-red-500">*</span>
    </label>

    <input
      :id="fieldId"
      v-model="model"
      :type="type"
      :placeholder="placeholder"
      :disabled="disabled"
      :required="required"
      :min="min"
      :max="max"
      :step="step"
      :autofocus="autofocus"
      :inputmode="inputmode"
      :class="inputClasses"
      :aria-invalid="Boolean(error)"
    />

    <p v-if="error" class="text-xs text-red-600 dark:text-red-400">{{ error }}</p>
    <p v-else-if="hint" class="text-xs text-slate-500 dark:text-slate-400">{{ hint }}</p>
  </div>
</template>
