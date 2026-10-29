<script setup lang="ts">
import { computed } from 'vue'
import { SHIFT_TYPE_LIST } from '@/constants/shift-types'
import { sortEmployees } from '@/utils/employee'
import { useEmployeesStore } from '@/stores/employees'
import { useUiStore } from '@/stores/ui'
import AppButton from '@/components/ui/AppButton.vue'
import AppIcon from '@/components/ui/AppIcon.vue'

const ui = useUiStore()
const employeesStore = useEmployeesStore()

const employees = computed(() =>
  sortEmployees(
    employeesStore.items.filter((employee) => ui.filters.showInactive || employee.active),
  ),
)

const departments = computed(() => employeesStore.departments)
const shiftTypes = computed(() => SHIFT_TYPE_LIST)

const allSelected = computed(
  () =>
    employees.value.length > 0 &&
    employees.value.every((employee) => ui.filters.employeeIds.includes(employee.id)),
)

function toggleAllEmployees(): void {
  if (allSelected.value) {
    ui.setEmployees([])
    return
  }
  ui.setEmployees(employees.value.map((employee) => employee.id))
}

function selectDepartment(department: string): void {
  ui.filters.departments = [department]
  ui.setEmployees([])
}
</script>

<template>
  <div
    class="space-y-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
  >
    <div class="flex items-center justify-between gap-2">
      <h3 class="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
        <AppIcon name="filter" :size="16" />
        Фильтры
        <span
          v-if="ui.activeFiltersCount"
          class="rounded-md bg-blue-100 px-1.5 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-500/20 dark:text-blue-300"
        >
          {{ ui.activeFiltersCount }}
        </span>
      </h3>
      <AppButton variant="ghost" size="sm" @click="ui.resetFilters()">Сбросить</AppButton>
    </div>

    <!-- Работники -->
    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <span class="text-xs font-medium text-slate-600 dark:text-slate-300">Сотрудники</span>
        <button
          type="button"
          class="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
          @click="toggleAllEmployees"
        >
          {{ allSelected ? 'Снять все' : 'Выбрать все' }}
        </button>
      </div>

      <div class="sc-scroll flex max-h-48 flex-wrap gap-1.5 overflow-y-auto pr-1">
        <button
          v-for="employee in employees"
          :key="employee.id"
          type="button"
          class="flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs transition-colors"
          :class="
            ui.filters.employeeIds.includes(employee.id)
              ? 'border-transparent text-white'
              : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
          "
          :style="
            ui.filters.employeeIds.includes(employee.id)
              ? { backgroundColor: employee.color }
              : {}
          "
          @click="ui.toggleEmployee(employee.id)"
        >
          <span
            class="h-2 w-2 rounded-full"
            :style="{ backgroundColor: ui.filters.employeeIds.includes(employee.id) ? '#fff' : employee.color }"
          />
          {{ employee.lastName }} {{ employee.firstName.charAt(0) }}.
        </button>
      </div>

      <p v-if="employees.length === 0" class="text-xs text-slate-400">
        Нет сотрудников, подходящих под условие
      </p>
    </div>

    <!-- Отделы -->
    <div v-if="departments.length > 0" class="space-y-2">
      <span class="text-xs font-medium text-slate-600 dark:text-slate-300">Отделы</span>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="department in departments"
          :key="department"
          type="button"
          class="rounded-lg border px-2 py-1 text-xs transition-colors"
          :class="
            ui.filters.departments.includes(department)
              ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300'
              : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
          "
          @click="ui.toggleDepartment(department)"
        >
          {{ department }}
        </button>
        <button
          v-if="ui.filters.departments.length > 0"
          type="button"
          class="rounded-lg px-2 py-1 text-xs text-slate-500 hover:underline"
          @click="
            () => {
              ui.filters.departments = []
            }
          "
        >
          все отделы
        </button>
      </div>
    </div>

    <!-- Типы смен -->
    <div class="space-y-2">
      <span class="text-xs font-medium text-slate-600 dark:text-slate-300">Типы смен</span>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="type in shiftTypes"
          :key="type.code"
          type="button"
          class="flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs transition-colors"
          :class="
            ui.filters.shiftTypes.includes(type.code)
              ? 'border-transparent text-white'
              : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
          "
          :style="
            ui.filters.shiftTypes.includes(type.code) ? { backgroundColor: type.color } : {}
          "
          @click="ui.toggleShiftType(type.code)"
        >
          {{ type.label }}
        </button>
      </div>
    </div>

    <!-- Переключатели -->
    <div class="space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
      <label class="flex cursor-pointer items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
        <input
          type="checkbox"
          class="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800"
          :checked="ui.filters.onlyWorkDays"
          @change="ui.setOnlyWorkDays(($event.target as HTMLInputElement).checked)"
        />
        Только рабочие смены
      </label>

      <label class="flex cursor-pointer items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
        <input
          type="checkbox"
          class="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800"
          :checked="ui.filters.showInactive"
          @change="ui.setShowInactive(($event.target as HTMLInputElement).checked)"
        />
        Показывать архивных сотрудников
      </label>
    </div>

    <div v-if="employees.length === 0" class="rounded-lg bg-amber-50 p-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
      <button type="button" class="underline" @click="ui.resetFilters()">
        Сбросить фильтры
      </button>
      <span class="ml-1">чтобы увидеть сотрудников</span>
    </div>

    <slot name="footer" :select-department="selectDepartment" />
  </div>
</template>
