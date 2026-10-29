<script setup lang="ts">
import { computed } from 'vue'
import { useReportsStore } from '@/stores/reports'
import { useEmployeesStore } from '@/stores/employees'
import ReportsFilters from '@/components/reports/ReportsFilters.vue'
import ReportTotals from '@/components/reports/ReportTotals.vue'
import ReportsSummaryTable from '@/components/reports/ReportsSummaryTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import type { ReportByTypeRow } from '@/types'

const reportsStore = useReportsStore()
const employeesStore = useEmployeesStore()

/** Таблица «сотрудник × тип смены», сгруппированная по сотруднику. */
const byTypeGroups = computed(() => {
  const map = new Map<string, { name: string; rows: ReportByTypeRow[] }>()
  for (const row of reportsStore.report.byType) {
    const bucket = map.get(row.employeeId)
    if (bucket) bucket.rows.push(row)
    else map.set(row.employeeId, { name: row.employeeName, rows: [row] })
  }
  return [...map.entries()].map(([employeeId, value]) => ({ employeeId, ...value }))
})

/** Дни без назначенного шаблона — сигнал, что график настроен не полностью. */
const unassigned = computed(() =>
  reportsStore.report.rows.filter((row) => row.unassignedDays > 0),
)
</script>

<template>
  <div class="space-y-4">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Отчёты по сменам и часам</h2>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          Период: <span class="capitalize">{{ reportsStore.periodTitle }}</span> ·
          сотрудников: {{ reportsStore.employeesForReport.length }} ·
          учтено переопределений: {{ reportsStore.report.totals.manualOverrides }}
        </p>
      </div>
    </header>

    <ReportsFilters />

    <EmptyState
      v-if="employeesStore.activeEmployees.length === 0"
      icon="users"
      title="Нет активных работников"
      description="Добавьте сотрудников и назначьте им шаблоны графиков, чтобы построить отчёт."
    >
      <RouterLink to="/employees">
        <AppButton variant="primary" size="sm">
          <AppIcon name="users" :size="15" />
          Перейти к работникам
        </AppButton>
      </RouterLink>
    </EmptyState>

    <template v-else>
      <ReportTotals :report="reportsStore.report" />

      <ReportsSummaryTable :report="reportsStore.report" />

      <section
        v-if="byTypeGroups.length > 0"
        class="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
      >
        <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Группировка по типам смен
        </h3>

        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div
            v-for="group in byTypeGroups"
            :key="group.employeeId"
            class="rounded-xl border border-slate-200 p-3 dark:border-slate-800"
          >
            <p class="mb-2 text-sm font-medium text-slate-800 dark:text-slate-100">{{ group.name }}</p>
            <ul class="space-y-1">
              <li
                v-for="row in group.rows"
                :key="`${group.employeeId}-${row.type}`"
                class="flex items-center justify-between text-xs"
              >
                <span class="flex items-center gap-1.5">
                  <span class="h-2.5 w-2.5 rounded-sm" :style="{ backgroundColor: row.color }" />
                  <span class="text-slate-600 dark:text-slate-300">{{ row.label }}</span>
                </span>
                <span class="font-medium text-slate-700 dark:text-slate-200">
                  {{ row.count }} дн.
                  <span v-if="row.hours" class="text-slate-400">· {{ row.hours }} ч</span>
                </span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <p
        v-if="unassigned.length > 0"
        class="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
      >
        <strong>Внимание:</strong> у {{ unassigned.length }} сотрудников есть дни без назначенного
        шаблона — они не учитываются в подсчёте смен. Назначьте графики в разделе «Работники».
      </p>

      <p class="text-xs text-slate-400">
        Отчёт строится по вычисленным дням: ручные переопределения имеют приоритет над шаблоном.
      </p>
    </template>
  </div>
</template>
