<script setup lang="ts">
import { computed } from 'vue'
import { useUiStore } from '@/stores/ui'
import { useBackHandler } from '@/composables/useBackHandler'
import AppHeader from './AppHeader.vue'
import AppSidebar from './AppSidebar.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import { RouterLink } from 'vue-router'

const props = defineProps<{
  lastSavedAt?: string | null
  saveError?: string | null
  persistent?: boolean
}>()

const ui = useUiStore()

// На Android «Назад» сначала закрывает мобильное меню.
useBackHandler(
  () => ui.mobileNavOpen,
  () => ui.toggleMobileNav(false),
)

/** Мобильное меню повторяет основную навигацию. */
const mobileItems = computed(() => [
  { to: '/calendar', label: 'Календарь', icon: 'calendar' },
  { to: '/templates', label: 'Шаблоны графиков', icon: 'layers' },
  { to: '/employees', label: 'Работники', icon: 'users' },
  { to: '/reports', label: 'Отчёты', icon: 'chart' },
  { to: '/data', label: 'Экспорт и импорт', icon: 'database' },
])
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <AppHeader
      :last-saved-at="props.lastSavedAt"
      :save-error="props.saveError"
      :persistent="props.persistent"
    />

    <div class="flex flex-1 items-stretch">
      <div class="hidden lg:flex">
        <AppSidebar />
      </div>

      <!-- Мобильная навигация -->
      <Transition name="sc-fade">
        <div
          v-if="ui.mobileNavOpen"
          class="fixed inset-0 z-40 bg-slate-900/50 lg:hidden"
          @click.self="ui.toggleMobileNav(false)"
        >
          <nav
            class="sc-scroll h-full w-72 max-w-[85%] overflow-y-auto bg-white p-4 dark:bg-slate-900"
          >
            <div class="mb-4 flex items-center justify-between">
              <span class="text-sm font-semibold text-slate-800 dark:text-slate-100">Меню</span>
              <button
                type="button"
                class="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Закрыть меню"
                @click="ui.toggleMobileNav(false)"
              >
                <AppIcon name="close" :size="18" />
              </button>
            </div>

            <RouterLink
              v-for="item in mobileItems"
              :key="item.to"
              :to="item.to"
              class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
              @click="ui.toggleMobileNav(false)"
            >
              <AppIcon :name="item.icon" :size="18" />
              {{ item.label }}
            </RouterLink>
          </nav>
        </div>
      </Transition>

      <main class="min-w-0 flex-1 px-3 py-4 sm:px-5 sm:py-6">
        <slot />
      </main>
    </div>
  </div>
</template>
