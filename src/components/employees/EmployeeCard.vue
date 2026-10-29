<script setup lang="ts">
import { computed } from 'vue'
import type { Employee } from '@/types'
import { fullName, initials } from '@/utils/employee'
import { formatDateHuman, todayISO } from '@/utils/date'
import { useScheduleStore } from '@/stores/schedule'
import { useTemplatesStore } from '@/stores/templates'
import AppBadge from '@/components/ui/AppBadge.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppIcon from '@/components/ui/AppIcon.vue'

const props = defineProps<{
  employee: Employee
  selected?: boolean
}>()

const emit = defineEmits<{
  select: [employee: Employee]
  edit: [employee: Employee]
  assign: [employee: Employee]
  toggleActive: [employee: Employee]
  remove: [employee: Employee]
}>()

const scheduleStore = useScheduleStore()
const templatesStore = useTemplatesStore()

/** Действующий график на сегодня. */
const currentAssignment = computed(() =>
  scheduleStore.currentAssignmentFor(props.employee.id, todayISO()),
)

/** График, который начнётся позже: это НЕ то же самое, что «шаблон не назначен». */
const upcomingAssignment = computed(() =>
  scheduleStore.nextAssignmentFor(props.employee.id, todayISO()),
)

const overridesCount = computed(() => scheduleStore.overridesForEmployee(props.employee.id).length)
const conflictsCount = computed(() => scheduleStore.conflictsForEmployee(props.employee.id).length)
</script>

<template>
  <article
    data-testid="employee-card"
    class="cursor-pointer rounded-xl border bg-white p-3 transition-colors dark:bg-slate-900"
    :class="
      selected
        ? 'border-blue-400 ring-1 ring-blue-300 dark:border-blue-500'
        : 'border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700'
    "
    @click="emit('select', employee)"
  >
    <div class="flex items-start gap-3">
      <span
        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold text-white"
        :style="{ backgroundColor: employee.color }"
      >
        {{ initials(employee) }}
      </span>

      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-1.5">
          <h3 class="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
            {{ fullName(employee) }}
          </h3>
          <AppBadge v-if="!employee.active" size="sm" label="архив" />
          <AppBadge
            v-if="conflictsCount > 0"
            size="sm"
            color="#f59e0b"
            :label="`конфликтов: ${conflictsCount}`"
          />
        </div>

        <p class="truncate text-xs text-slate-500 dark:text-slate-400">
          {{ employee.position || 'Должность не указана' }}
          <span v-if="employee.department">· {{ employee.department }}</span>
        </p>

        <p class="mt-1 truncate text-xs">
          <span v-if="currentAssignment" class="text-slate-600 dark:text-slate-300">
            График: {{ templatesStore.nameOf(currentAssignment.templateId) }}
            <span class="text-slate-400">с {{ formatDateHuman(currentAssignment.startDate) }}</span>
          </span>
          <span v-else-if="upcomingAssignment" class="text-blue-600 dark:text-blue-400">
            График: {{ templatesStore.nameOf(upcomingAssignment.templateId) }}
            <span class="text-slate-400">
              начнётся {{ formatDateHuman(upcomingAssignment.startDate) }}
            </span>
          </span>
          <span v-else class="text-amber-600 dark:text-amber-400">Шаблон не назначен</span>
        </p>

        <p v-if="overridesCount > 0" class="mt-0.5 text-[11px] text-blue-600 dark:text-blue-400">
          Ручных изменений: {{ overridesCount }}
        </p>
      </div>

      <div class="flex shrink-0 flex-col gap-1" @click.stop>
        <AppButton size="sm" variant="ghost" title="Назначить шаблон" @click="emit('assign', employee)">
          <AppIcon name="layers" :size="15" />
        </AppButton>
        <AppButton size="sm" variant="ghost" title="Редактировать" @click="emit('edit', employee)">
          <AppIcon name="pencil" :size="15" />
        </AppButton>
        <AppButton
          size="sm"
          variant="ghost"
          :title="employee.active ? 'В архив' : 'Вернуть из архива'"
          @click="emit('toggleActive', employee)"
        >
          <AppIcon :name="employee.active ? 'archive' : 'refresh'" :size="15" />
        </AppButton>
        <AppButton size="sm" variant="ghost" title="Удалить" @click="emit('remove', employee)">
          <AppIcon name="trash" :size="15" class="text-red-500" />
        </AppButton>
      </div>
    </div>
  </article>
</template>
