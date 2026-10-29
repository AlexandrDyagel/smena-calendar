<script setup lang="ts">
import { computed } from 'vue'
import { COLOR_PALETTE } from '@/utils/color'
import AppIcon from './AppIcon.vue'

const props = withDefaults(
  defineProps<{
    label?: string
    /** Разрешить ввод произвольного HEX-цвета. */
    allowCustom?: boolean
    hint?: string
  }>(),
  { allowCustom: true },
)

const model = defineModel<string>({ default: COLOR_PALETTE[0]! })

const isCustom = computed(() => !COLOR_PALETTE.includes(model.value?.toLowerCase() ?? ''))

function select(color: string): void {
  model.value = color
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <span v-if="label" class="text-xs font-medium text-slate-600 dark:text-slate-300">
      {{ label }}
    </span>

    <div class="flex flex-wrap items-center gap-2">
      <button
        v-for="color in COLOR_PALETTE"
        :key="color"
        type="button"
        class="h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        :style="{
          backgroundColor: color,
          borderColor: model?.toLowerCase() === color ? '#0f172a' : 'transparent',
        }"
        :title="color"
        :aria-label="`Выбрать цвет ${color}`"
        @click="select(color)"
      >
        <AppIcon
          v-if="model?.toLowerCase() === color"
          name="check"
          :size="14"
          class="mx-auto text-white drop-shadow"
        />
      </button>

      <label
        v-if="allowCustom"
        class="flex items-center gap-1.5 rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-600 dark:border-slate-600 dark:text-slate-300"
      >
        <input
          v-model="model"
          type="color"
          class="h-5 w-6 cursor-pointer border-0 bg-transparent p-0"
          aria-label="Произвольный цвет"
        />
        <span class="font-mono">{{ model }}</span>
      </label>
    </div>

    <p v-if="hint" class="text-xs text-slate-500 dark:text-slate-400">{{ hint }}</p>
    <p v-if="isCustom" class="text-xs text-slate-400 dark:text-slate-500">
      Используется произвольный цвет
    </p>
  </div>
</template>
