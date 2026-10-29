<script setup lang="ts">
import { computed } from 'vue'
import type { CalendarViewMode } from '@/types'
import { useUiStore } from '@/stores/ui'
import AppButton from '@/components/ui/AppButton.vue'
import AppIcon from '@/components/ui/AppIcon.vue'

const ui = useUiStore()

const modes: Array<{ value: CalendarViewMode; label: string; icon: string }> = [
  { value: 'month', label: 'Месяц', icon: 'calendar' },
  { value: 'week', label: 'Неделя', icon: 'list' },
  { value: 'list', label: 'Список', icon: 'list' },
]

const isCurrentPeriod = computed(() => {
  const today = new Date()
  const y = today.getFullYear()
  const m = String(today.getMonth() + 1).padStart(2, '0')
  return ui.anchorDate.startsWith(`${y}-${m}`)
})
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <div class="flex items-center gap-1">
      <AppButton variant="secondary" size="sm" aria-label="Предыдущий период" @click="ui.previous()">
        <AppIcon name="chevronLeft" :size="16" />
      </AppButton>
      <AppButton variant="secondary" size="sm" aria-label="Следующий период" @click="ui.next()">
        <AppIcon name="chevronRight" :size="16" />
      </AppButton>
      <AppButton
        variant="secondary"
        size="sm"
        :disabled="isCurrentPeriod && ui.viewMode !== 'week'"
        @click="ui.goToday()"
      >
        Сегодня
      </AppButton>
    </div>

    <h2 class="min-w-[190px] text-base font-semibold capitalize text-slate-800 dark:text-slate-100">
      {{ ui.periodTitle }}
    </h2>

    <div
      class="ml-auto flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-900"
      role="tablist"
      aria-label="Режим отображения"
    >
      <button
        v-for="mode in modes"
        :key="mode.value"
        type="button"
        role="tab"
        :aria-selected="ui.viewMode === mode.value"
        class="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors"
        :class="
          ui.viewMode === mode.value
            ? 'bg-blue-600 text-white'
            : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
        "
        @click="ui.setViewMode(mode.value)"
      >
        <AppIcon :name="mode.icon" :size="14" />
        {{ mode.label }}
      </button>
    </div>
  </div>
</template>
