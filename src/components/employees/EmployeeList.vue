<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Employee } from '@/types'
import { fullName, sortEmployees } from '@/utils/employee'
import { useEmployeesStore } from '@/stores/employees'
import { useScheduleStore } from '@/stores/schedule'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import AppButton from '@/components/ui/AppButton.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import EmployeeCard from './EmployeeCard.vue'
import EmployeeFormModal from './EmployeeFormModal.vue'
import EmployeeAssignTemplateModal from './EmployeeAssignTemplateModal.vue'
import EmployeeSchedulePreview from './EmployeeSchedulePreview.vue'

const employeesStore = useEmployeesStore()
const scheduleStore = useScheduleStore()
const { confirm } = useConfirm()
const toast = useToast()

const search = ref('')
const showArchived = ref(true)
const selectedId = ref<string | null>(null)

const formOpen = ref(false)
const formEmployee = ref<Employee | null>(null)
const assignOpen = ref(false)
const assignEmployee = ref<Employee | null>(null)

const filtered = computed(() => {
  const query = search.value.trim().toLowerCase()
  return sortEmployees(
    employeesStore.items.filter((employee) => {
      if (!showArchived.value && !employee.active) return false
      if (!query) return true
      const haystack = [
        employee.lastName,
        employee.firstName,
        employee.middleName ?? '',
        employee.position ?? '',
        employee.department ?? '',
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(query)
    }),
  )
})

const selected = computed(() => (selectedId.value ? employeesStore.getById(selectedId.value) : undefined))

const stats = computed(() => {
  const total = employeesStore.items.length
  const active = employeesStore.activeEmployees.length
  return { total, active, archived: total - active, departments: employeesStore.departments.length }
})

function openCreate(): void {
  formEmployee.value = null
  formOpen.value = true
}

function openEdit(employee: Employee): void {
  formEmployee.value = employee
  formOpen.value = true
}

function openAssign(employee: Employee): void {
  assignEmployee.value = employee
  assignOpen.value = true
  selectedId.value = employee.id
}

function select(employee: Employee): void {
  selectedId.value = selectedId.value === employee.id ? null : employee.id
}

function toggleActive(employee: Employee): void {
  if (employee.active) {
    employeesStore.deactivate(employee.id)
    toast.info('Работник переведён в архив', `${fullName(employee)} — история смен сохранена`)
    return
  }
  employeesStore.activate(employee.id)
  toast.success('Работник возвращён из архива', fullName(employee))
}

async function remove(employee: Employee): Promise<void> {
  const assignmentCount = scheduleStore.assignmentsForEmployee(employee.id).length
  const overrideCount = scheduleStore.overridesForEmployee(employee.id).length

  const ok = await confirm({
    title: 'Удалить работника полностью?',
    message: `${fullName(employee)} будет удалён вместе со своей историей смен.`,
    details: [
      `Назначений шаблона: ${assignmentCount}`,
      `Ручных переопределений: ${overrideCount}`,
      'Действие необратимо. Если нужно сохранить историю — используйте архивирование.',
    ],
    confirmLabel: 'Удалить навсегда',
    danger: true,
  })
  if (!ok) return

  if (selectedId.value === employee.id) selectedId.value = null
  employeesStore.remove(employee.id)
  toast.success('Работник удалён', fullName(employee))
}
</script>

<template>
  <div class="space-y-4">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Работники</h2>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          Всего: {{ stats.total }} · активных: {{ stats.active }} · в архиве: {{ stats.archived }} ·
          отделов: {{ stats.departments }}
        </p>
      </div>

      <AppButton variant="primary" size="sm" @click="openCreate">
        <AppIcon name="plus" :size="15" />
        Добавить работника
      </AppButton>
    </header>

    <div class="grid gap-4 lg:grid-cols-[minmax(320px,420px)_1fr]">
      <!-- Список -->
      <section class="space-y-3" data-testid="employee-list">
        <div class="flex flex-wrap items-center gap-2">
          <div class="relative min-w-[180px] flex-1">
            <AppIcon
              name="filter"
              :size="15"
              class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              v-model="search"
              type="search"
              placeholder="Поиск по ФИО, отделу, должности"
              class="w-full rounded-lg border border-slate-300 py-2 pl-8 pr-3 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
          <label class="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
            <input
              v-model="showArchived"
              type="checkbox"
              class="h-4 w-4 rounded border-slate-300 text-blue-600 dark:border-slate-600 dark:bg-slate-800"
            />
            архив
          </label>
        </div>

        <EmptyState
          v-if="filtered.length === 0"
          icon="users"
          title="Работники не найдены"
          description="Измените поисковый запрос или добавьте нового работника."
        >
          <AppButton variant="primary" size="sm" @click="openCreate">
            <AppIcon name="plus" :size="15" />
            Добавить
          </AppButton>
        </EmptyState>

        <div v-else class="sc-scroll max-h-[70vh] space-y-2 overflow-y-auto pr-1">
          <EmployeeCard
            v-for="employee in filtered"
            :key="employee.id"
            :employee="employee"
            :selected="employee.id === selectedId"
            @select="select"
            @edit="openEdit"
            @assign="openAssign"
            @toggle-active="toggleActive"
            @remove="remove"
          />
        </div>
      </section>

      <!-- Карточка сотрудника -->
      <section
        data-testid="employee-detail"
        class="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
      >
        <EmptyState
          v-if="!selected"
          icon="eye"
          title="Выберите сотрудника"
          description="Здесь появятся индивидуальный календарь, история назначений и ручные изменения дней."
        />

        <div v-else class="space-y-4">
          <header class="flex flex-wrap items-start gap-3">
            <span
              class="flex h-12 w-12 items-center justify-center rounded-xl text-base font-semibold text-white"
              :style="{ backgroundColor: selected.color }"
            >
              {{ selected.lastName.charAt(0) }}{{ selected.firstName.charAt(0) }}
            </span>
            <div class="min-w-0 flex-1">
              <h3 class="text-base font-semibold text-slate-900 dark:text-slate-100">
                {{ fullName(selected) }}
              </h3>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                {{ selected.position || 'Должность не указана' }}
                <span v-if="selected.department">· {{ selected.department }}</span>
              </p>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <AppButton size="sm" variant="secondary" @click="openAssign(selected)">
                <AppIcon name="layers" :size="15" />
                Назначить шаблон
              </AppButton>
              <AppButton size="sm" variant="secondary" @click="openEdit(selected)">
                <AppIcon name="pencil" :size="15" />
                Изменить
              </AppButton>
            </div>
          </header>

          <EmployeeSchedulePreview :employee-id="selected.id" />
        </div>
      </section>
    </div>

    <EmployeeFormModal v-model:open="formOpen" :employee="formEmployee" />
    <EmployeeAssignTemplateModal
      v-model:open="assignOpen"
      :employee="assignEmployee"
      @saved="() => {}"
    />
  </div>
</template>
