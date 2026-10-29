<script setup lang="ts">
import { computed } from 'vue'
import { SHIFT_TYPE_LIST } from '@/constants/shift-types'
import { withAlpha } from '@/utils/color'
import AppIcon from '@/components/ui/AppIcon.vue'

withDefaults(defineProps<{ compact?: boolean }>(), {})

const types = computed(() => SHIFT_TYPE_LIST)
</script>

<template>
  <div
    class="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
  >
    <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
      Легенда смен
    </h3>

    <ul class="flex flex-wrap gap-x-4 gap-y-2">
      <li v-for="type in types" :key="type.code" class="flex items-center gap-2">
        <span
          class="flex h-5 w-6 items-center justify-center rounded text-[10px] font-bold"
          :style="{
            backgroundColor: withAlpha(type.color, 0.18),
            color: type.color,
            border: `1px solid ${withAlpha(type.color, 0.35)}`,
          }"
        >
          {{ type.shortLabel }}
        </span>
        <span class="text-xs text-slate-600 dark:text-slate-300">
          {{ type.label }}
          <span v-if="!compact && type.defaultHours" class="text-slate-400">
            · {{ type.defaultHours }} ч
          </span>
        </span>
      </li>
    </ul>

    <ul
      v-if="!compact"
      class="mt-3 flex flex-wrap gap-x-4 gap-y-2 border-t border-slate-100 pt-3 dark:border-slate-800"
    >
      <li class="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        <AppIcon name="pencil" :size="13" />
        день изменён вручную
      </li>
      <li class="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        <span class="h-3 w-3 rounded-full border-2 border-blue-500" />
        сегодняшний день
      </li>
      <li class="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        <AppIcon name="alert" :size="13" class="text-amber-500" />
        конфликт назначений
      </li>
      <li class="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        <span class="h-3 w-3 rounded bg-rose-100 dark:bg-rose-500/20" />
        выходной или праздник
      </li>
    </ul>
  </div>
</template>
