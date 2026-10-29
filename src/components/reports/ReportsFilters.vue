<script setup lang="ts">
import { computed } from 'vue'
import type { PeriodPreset } from '@/types'
import { useEmployeesStore } from '@/stores/employees'
import { useReportsStore } from '@/stores/reports'
import { useToast } from '@/composables/useToast'
import AppButton from '@/components/ui/AppButton.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import AppSelect from '@/components/ui/AppSelect.vue'

const reportsStore = useReportsStore()
const employeesStore = useEmployeesStore()
const toast = useToast()

const presets: Array<{ value: PeriodPreset; label: string }> = [
  { value: 'month', label: 'Месяц' },
  { value: 'quarter', label: 'Квартал' },
  { value: 'year', label: 'Год' },
  { value: 'custom', label: 'Произвольный' },
]

const departmentOptions = computed(() => [
  { value: '', label: 'Все отделы' },
  ...employeesStore.departments.map((department) => ({ value: department, label: department })),
])

function selectPreset(preset: PeriodPreset): void {
  if (preset === 'custom') {
    // Границы остаются текущими — пользователь задаст их вручную.
    reportsStore.preset = 'custom'
    return
  }
  // Точка отсчёта берётся из стора, поэтому «Год → Месяц» возвращает к тому же месяцу.
  reportsStore.setPreset(preset)
}

function onBoundaryChange(field: 'from' | 'to', event: Event): void {
  reportsStore.setBoundary(field, (event.target as HTMLInputElement).value)
}

/** Общий обработчик экспорта: показывает, куда сохранён файл. */
async function exportFile(kind: 'summary' | 'byType'): Promise<void> {
  const { filename, result } =
    kind === 'summary'
      ? await reportsStore.exportSummaryCsv()
      : await reportsStore.exportByTypeCsv()

  if (result.ok) {
    toast.success('Отчёт сохранён', `${filename} → ${result.location ?? ''}`)
  } else {
    toast.error('Не удалось сохранить отчёт', result.error)
  }
}
</script>

<template>
  <div class="space-y-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
    <div class="flex flex-wrap items-center gap-3">
      <div class="flex items-center gap-1">
        <AppButton
          size="sm"
          variant="secondary"
          title="Предыдущий период"
          aria-label="Предыдущий период"
          @click="reportsStore.shiftPeriod(-1)"
        >
          <AppIcon name="chevronLeft" :size="15" />
        </AppButton>
        <AppButton
          size="sm"
          variant="secondary"
          title="Следующий период"
          aria-label="Следующий период"
          @click="reportsStore.shiftPeriod(1)"
        >
          <AppIcon name="chevronRight" :size="15" />
        </AppButton>
      </div>

      <div
        class="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-950/40"
      >
        <button
          v-for="preset in presets"
          :key="preset.value"
          type="button"
          class="rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors"
          :class="
            reportsStore.preset === preset.value
              ? 'bg-blue-600 text-white'
              : 'text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-800'
          "
          @click="selectPreset(preset.value)"
        >
          {{ preset.label }}
        </button>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <label class="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          с
          <input
            :value="reportsStore.period.from"
            type="date"
            class="rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            @change="onBoundaryChange('from', $event)"
          />
        </label>
        <label class="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          по
          <input
            :value="reportsStore.period.to"
            type="date"
            class="rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            @change="onBoundaryChange('to', $event)"
          />
        </label>
      </div>

      <div class="ml-auto flex flex-wrap items-center gap-2">
        <AppButton variant="secondary" size="sm" @click="exportFile('summary')">
          <AppIcon name="download" :size="15" />
          Отчёт в CSV
        </AppButton>
        <AppButton
          variant="ghost"
          size="sm"
          :disabled="reportsStore.report.byType.length === 0"
          @click="exportFile('byType')"
        >
          <AppIcon name="download" :size="15" />
          Детализация в CSV
        </AppButton>
      </div>
    </div>

    <p v-if="reportsStore.isPeriodInvalid" class="text-xs text-red-600 dark:text-red-400">
      Дата начала позже даты окончания — исправьте период.
    </p>

    <div class="grid gap-4 lg:grid-cols-[1fr_240px]">
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-slate-600 dark:text-slate-300">Сотрудники</span>
          <div class="flex items-center gap-2 text-xs">
            <button
              type="button"
              class="text-blue-600 hover:underline dark:text-blue-400"
              @click="reportsStore.setEmployees(reportsStore.employeesInScope.map((employee) => employee.id))"
            >
              выбрать всех
            </button>
            <button
              type="button"
              class="text-slate-500 hover:underline"
              @click="reportsStore.setEmployees([])"
            >
              сбросить
            </button>
          </div>
        </div>

        <div class="sc-scroll flex max-h-32 flex-wrap gap-1.5 overflow-y-auto pr-1">
          <button
            v-for="employee in reportsStore.employeesInScope"
            :key="employee.id"
            type="button"
            class="flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs transition-colors"
            :class="
              reportsStore.employeeIds.includes(employee.id)
                ? 'border-transparent text-white'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
            "
            :style="
              reportsStore.employeeIds.includes(employee.id)
                ? { backgroundColor: employee.color }
                : {}
            "
            @click="reportsStore.toggleEmployee(employee.id)"
          >
            {{ employee.lastName }} {{ employee.firstName.charAt(0) }}.
          </button>
        </div>

        <p class="text-xs text-slate-400">
          {{
            reportsStore.employeeIds.length === 0
              ? 'Выбраны все сотрудники в области видимости'
              : `Выбрано: ${reportsStore.employeeIds.length}`
          }}
        </p>
      </div>

      <AppSelect
        v-model="reportsStore.department"
        label="Отдел"
        :options="departmentOptions"
      />
    </div>
  </div>
</template>
