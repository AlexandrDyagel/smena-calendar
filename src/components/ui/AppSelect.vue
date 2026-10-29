<script setup lang="ts">
import { computed, useId } from 'vue'
import AppIcon from './AppIcon.vue'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

const props = withDefaults(
  defineProps<{
    label?: string
    options: SelectOption[]
    placeholder?: string
    hint?: string
    error?: string
    required?: boolean
    disabled?: boolean
  }>(),
  {},
)

const model = defineModel<string>({ default: '' })

const fieldId = useId()

const classes = computed(() => [
  'w-full appearance-none rounded-lg border px-3 py-2 pr-9 text-sm transition-colors',
  'bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100',
  'focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500',
  'disabled:cursor-not-allowed disabled:bg-slate-100 dark:disabled:bg-slate-800',
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

    <div class="relative">
      <select
        :id="fieldId"
        v-model="model"
        :disabled="disabled"
        :required="required"
        :class="classes"
        :aria-invalid="Boolean(error)"
      >
        <option v-if="placeholder" value="">{{ placeholder }}</option>
        <option
          v-for="option in options"
          :key="option.value"
          :value="option.value"
          :disabled="option.disabled"
        >
          {{ option.label }}
        </option>
      </select>
      <AppIcon
        name="chevronDown"
        :size="16"
        class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
      />
    </div>

    <p v-if="error" class="text-xs text-red-600 dark:text-red-400">{{ error }}</p>
    <p v-else-if="hint" class="text-xs text-slate-500 dark:text-slate-400">{{ hint }}</p>
  </div>
</template>
