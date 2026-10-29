<script setup lang="ts">
import { computed, ref } from 'vue'
import { useUiStore } from '@/stores/ui'
import { useEmployeesStore } from '@/stores/employees'
import { useTemplatesStore } from '@/stores/templates'
import { useScheduleStore } from '@/stores/schedule'
import { useCalendar } from '@/composables/useCalendar'
import { useToast } from '@/composables/useToast'
import { todayISO } from '@/utils/date'
import AppButton from '@/components/ui/AppButton.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import CalendarToolbar from '@/components/calendar/CalendarToolbar.vue'
import CalendarMonthView from '@/components/calendar/CalendarMonthView.vue'
import CalendarWeekView from '@/components/calendar/CalendarWeekView.vue'
import CalendarListView from '@/components/calendar/CalendarListView.vue'
import CalendarFiltersPanel from '@/components/calendar/CalendarFiltersPanel.vue'
import CalendarDayDetailsDrawer from '@/components/calendar/CalendarDayDetailsDrawer.vue'
import ShiftLegend from '@/components/calendar/ShiftLegend.vue'

const ui = useUiStore()
const employeesStore = useEmployeesStore()
const templatesStore = useTemplatesStore()
const scheduleStore = useScheduleStore()
const { visibleEmployees, hasEmployees } = useCalendar()
const toast = useToast()

const filtersOpen = ref(false)

const drawerOpen = computed({
  get: () => ui.selectedDate !== null,
  set: (value: boolean) => {
    if (!value) ui.closeDay()
  },
})

/** Совсем пустое приложение: ни сотрудников, ни шаблонов. */
const isBlank = computed(
  () => employeesStore.items.length === 0 && templatesStore.items.length === 0,
)

const overridesToday = computed(() => scheduleStore.overridesOn(todayISO()).length)

function clearFilters(): void {
  ui.resetFilters()
  toast.info('Фильтры сброшены')
}
</script>

<template>
  <div class="space-y-4">
    <CalendarToolbar />

    <EmptyState
      v-if="isBlank"
      icon="calendar"
      title="Данных пока нет"
      description="Создайте шаблоны сменных графиков и добавьте работников — или загрузите демонстрационные данные на экране «Экспорт и импорт»."
    >
      <RouterLink to="/templates">
        <AppButton variant="primary" size="sm">
          <AppIcon name="plus" :size="15" />
          Перейти к шаблонам
        </AppButton>
      </RouterLink>
      <RouterLink to="/data">
        <AppButton variant="secondary" size="sm">
          <AppIcon name="database" :size="15" />
          Загрузить демо-данные
        </AppButton>
      </RouterLink>
    </EmptyState>

    <div v-else class="grid gap-4 xl:grid-cols-[300px_1fr]">
      <!-- Панель фильтров -->
      <div class="space-y-3">
        <div class="xl:hidden">
          <AppButton variant="secondary" size="sm" block @click="filtersOpen = !filtersOpen">
            <AppIcon name="filter" :size="15" />
            Фильтры
            <span
              v-if="ui.activeFiltersCount"
              class="rounded bg-blue-600 px-1.5 text-[11px] font-semibold text-white"
            >
              {{ ui.activeFiltersCount }}
            </span>
          </AppButton>
        </div>

        <div :class="filtersOpen ? 'block' : 'hidden xl:block'">
          <CalendarFiltersPanel />
        </div>

        <ShiftLegend class="hidden xl:block" />

        <div
          v-if="overridesToday > 0"
          class="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200"
        >
          <p class="flex items-center gap-1.5 font-medium">
            <AppIcon name="pencil" :size="14" />
            Сегодня изменено вручную: {{ overridesToday }}
          </p>
          <p class="mt-1">
            <button type="button" class="underline" @click="ui.openDay(todayISO())">
              Открыть детали сегодняшнего дня
            </button>
          </p>
        </div>
      </div>

      <!-- Календарь -->
      <div class="space-y-3">
        <EmptyState
          v-if="!hasEmployees"
          compact
          icon="users"
          title="Нет сотрудников под текущими фильтрами"
          description="Возможно, выбраны фильтры по отделу или сотруднику, либо все работники в архиве."
        >
          <AppButton variant="secondary" size="sm" @click="clearFilters">
            <AppIcon name="refresh" :size="15" />
            Сбросить фильтры
          </AppButton>
        </EmptyState>

        <CalendarMonthView v-else-if="ui.viewMode === 'month'" />
        <CalendarWeekView v-else-if="ui.viewMode === 'week'" />
        <CalendarListView v-else />

        <div class="xl:hidden">
          <ShiftLegend compact />
        </div>

        <p class="text-xs text-slate-400 dark:text-slate-500">
          Клик по дню открывает панель с деталями: там можно переопределить смену конкретного
          сотрудника, указать причину или вернуть день к расчёту по шаблону.
        </p>
      </div>
    </div>

    <CalendarDayDetailsDrawer
      v-model:open="drawerOpen"
      :date="ui.selectedDate"
      :employees="visibleEmployees"
    />
  </div>
</template>
