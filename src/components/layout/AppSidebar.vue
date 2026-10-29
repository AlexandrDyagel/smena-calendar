<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useUiStore } from '@/stores/ui'
import { useTemplatesStore } from '@/stores/templates'
import { useEmployeesStore } from '@/stores/employees'
import { useScheduleStore } from '@/stores/schedule'
import AppIcon from '@/components/ui/AppIcon.vue'

interface NavItem {
  to: string
  label: string
  icon: string
  badge?: number
}

const route = useRoute()
const ui = useUiStore()
const templatesStore = useTemplatesStore()
const employeesStore = useEmployeesStore()
const scheduleStore = useScheduleStore()

const items = computed<NavItem[]>(() => [
  { to: '/calendar', label: 'Календарь', icon: 'calendar' },
  {
    to: '/templates',
    label: 'Шаблоны графиков',
    icon: 'layers',
    badge: templatesStore.items.length,
  },
  {
    to: '/employees',
    label: 'Работники',
    icon: 'users',
    badge: employeesStore.activeEmployees.length,
  },
  { to: '/reports', label: 'Отчёты', icon: 'chart' },
  { to: '/data', label: 'Экспорт и импорт', icon: 'database' },
])

const conflictCount = computed(() => scheduleStore.assignmentConflicts.length)

function isActive(to: string): boolean {
  return route.path === to || route.path.startsWith(`${to}/`)
}
</script>

<template>
  <aside
    class="sc-no-print flex shrink-0 flex-col border-r border-slate-200 bg-white/80 backdrop-blur transition-all dark:border-slate-800 dark:bg-slate-900/80"
    :class="ui.sidebarCollapsed ? 'w-[68px]' : 'w-64'"
  >
    <nav class="sc-scroll flex-1 space-y-1 overflow-y-auto p-3">
      <RouterLink
        v-for="item in items"
        :key="item.to"
        :to="item.to"
        class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
        :class="
          isActive(item.to)
            ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300'
            : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
        "
        :title="ui.sidebarCollapsed ? item.label : undefined"
      >
        <AppIcon :name="item.icon" :size="18" />
        <span v-if="!ui.sidebarCollapsed" class="flex-1 truncate">{{ item.label }}</span>
        <span
          v-if="!ui.sidebarCollapsed && item.badge !== undefined"
          class="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400"
        >
          {{ item.badge }}
        </span>
      </RouterLink>
    </nav>

    <div class="space-y-2 border-t border-slate-200 p-3 dark:border-slate-800">
      <RouterLink
        v-if="conflictCount > 0"
        to="/employees"
        class="flex items-start gap-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-700 hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-300"
        :title="`Конфликтов назначений: ${conflictCount}`"
      >
        <AppIcon name="alert" :size="16" class="mt-0.5" />
        <span v-if="!ui.sidebarCollapsed">
          Конфликтов назначений: <strong>{{ conflictCount }}</strong>
        </span>
      </RouterLink>

      <button
        type="button"
        class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        @click="ui.toggleSidebar()"
      >
        <AppIcon :name="ui.sidebarCollapsed ? 'chevronRight' : 'chevronLeft'" :size="16" />
        <span v-if="!ui.sidebarCollapsed">Свернуть панель</span>
      </button>
    </div>
  </aside>
</template>
