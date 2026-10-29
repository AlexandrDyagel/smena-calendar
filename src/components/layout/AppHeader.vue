<script setup lang="ts">
import { computed } from 'vue'
import { useTheme } from '@/composables/useTheme'
import { useUiStore } from '@/stores/ui'
import AppIcon from '@/components/ui/AppIcon.vue'
import AppButton from '@/components/ui/AppButton.vue'

const props = defineProps<{
  /** Время последнего сохранения (ISO) либо null. */
  lastSavedAt?: string | null
  /** Текст ошибки сохранения. */
  saveError?: string | null
  /** Работает ли постоянное хранилище браузера. */
  persistent?: boolean
}>()

const ui = useUiStore()
const { isDark, cycle } = useTheme()

const themeIcon = computed(() => {
  if (ui.theme === 'light') return 'sun'
  if (ui.theme === 'dark') return 'moon'
  return 'monitor'
})

const themeTitle = computed(() => {
  if (ui.theme === 'light') return 'Светлая тема (нажмите, чтобы переключить)'
  if (ui.theme === 'dark') return 'Тёмная тема (нажмите, чтобы переключить)'
  return 'Тема как в системе (нажмите, чтобы переключить)'
})

const savedLabel = computed(() => {
  if (!props.lastSavedAt) return null
  return new Date(props.lastSavedAt).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
})
</script>

<template>
  <header
    class="sc-no-print sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white/85 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/85"
  >
    <button
      type="button"
      class="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden dark:hover:bg-slate-800"
      aria-label="Меню"
      @click="ui.toggleMobileNav()"
    >
      <AppIcon name="menu" :size="20" />
    </button>

    <div class="flex min-w-0 items-center gap-2.5">
      <span
        class="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm"
      >
        <AppIcon name="calendar" :size="20" />
      </span>
      <div class="min-w-0">
        <h1 class="truncate text-sm font-semibold text-slate-900 sm:text-base dark:text-slate-100">
          Календарь сменных графиков
        </h1>
        <p class="hidden truncate text-xs text-slate-500 sm:block dark:text-slate-400">
          Циклические шаблоны, переопределения дней и отчёты по часам
        </p>
      </div>
    </div>

    <div class="ml-auto flex items-center gap-2">
      <span
        v-if="saveError"
        class="hidden items-center gap-1.5 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs text-red-700 sm:flex dark:bg-red-500/10 dark:text-red-300"
        :title="saveError"
      >
        <AppIcon name="alert" :size="14" />
        Не сохранено
      </span>
      <span
        v-else-if="savedLabel"
        class="hidden items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs text-slate-500 sm:flex dark:bg-slate-800 dark:text-slate-400"
        title="Данные сохраняются в браузере автоматически"
      >
        <AppIcon name="check" :size="14" />
        Сохранено в {{ savedLabel }}
      </span>

      <span
        v-if="persistent === false"
        class="hidden items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700 md:flex dark:bg-amber-500/10 dark:text-amber-300"
        title="Браузер запретил локальное хранилище: данные исчезнут после перезагрузки. Экспортируйте их в JSON."
      >
        <AppIcon name="alert" :size="14" />
        Хранилище недоступно
      </span>

      <AppButton
        variant="ghost"
        size="sm"
        :title="themeTitle"
        :aria-label="themeTitle"
        @click="cycle()"
      >
        <AppIcon :name="themeIcon" :size="18" />
        <span class="hidden md:inline">{{ isDark ? 'Тёмная' : 'Светлая' }}</span>
      </AppButton>
    </div>
  </header>
</template>
