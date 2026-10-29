<script setup lang="ts">
import AppIcon from './AppIcon.vue'

withDefaults(
  defineProps<{
    title: string
    description?: string
    icon?: string
    compact?: boolean
  }>(),
  { icon: 'info' },
)
</script>

<template>
  <div
    class="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white/60 text-center dark:border-slate-700 dark:bg-slate-900/40"
    :class="compact ? 'px-4 py-6' : 'px-6 py-10'"
  >
    <div
      class="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
    >
      <AppIcon :name="icon" :size="22" />
    </div>

    <div class="max-w-md space-y-1">
      <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-200">{{ title }}</h3>
      <p v-if="description" class="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        {{ description }}
      </p>
    </div>

    <div v-if="$slots.default" class="mt-1 flex flex-wrap items-center justify-center gap-2">
      <slot />
    </div>
  </div>
</template>
