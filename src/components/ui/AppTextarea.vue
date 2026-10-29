<script setup lang="ts">
import { computed, useId } from 'vue'

const props = withDefaults(
  defineProps<{
    label?: string
    placeholder?: string
    hint?: string
    error?: string
    required?: boolean
    disabled?: boolean
    rows?: number
  }>(),
  { rows: 3 },
)

const model = defineModel<string>({ default: '' })

const fieldId = useId()

const classes = computed(() => [
  'w-full rounded-lg border px-3 py-2 text-sm transition-colors resize-y',
  'bg-white text-slate-900 placeholder:text-slate-400',
  'dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500',
  'focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500',
  props.error ? 'border-red-400 dark:border-red-500' : 'border-slate-300 dark:border-slate-600',
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

    <textarea
      :id="fieldId"
      v-model="model"
      :rows="rows"
      :placeholder="placeholder"
      :disabled="disabled"
      :required="required"
      :class="classes"
    />

    <p v-if="error" class="text-xs text-red-600 dark:text-red-400">{{ error }}</p>
    <p v-else-if="hint" class="text-xs text-slate-500 dark:text-slate-400">{{ hint }}</p>
  </div>
</template>
