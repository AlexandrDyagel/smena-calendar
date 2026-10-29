<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ScheduleTemplate } from '@/types'
import { todayISO } from '@/utils/date'
import { useEmployeesStore } from '@/stores/employees'
import { useScheduleStore } from '@/stores/schedule'
import { useTemplatesStore } from '@/stores/templates'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import AppButton from '@/components/ui/AppButton.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import TemplateCard from './TemplateCard.vue'
import TemplateEditorModal from './TemplateEditorModal.vue'

const templatesStore = useTemplatesStore()
const employeesStore = useEmployeesStore()
const scheduleStore = useScheduleStore()
const { confirm } = useConfirm()
const toast = useToast()

const editorOpen = ref(false)
const editing = ref<ScheduleTemplate | null>(null)

const templates = computed(() => templatesStore.sorted)

/** Работники, у которых шаблон используется (по любому назначению). */
function usedByEmployees(templateId: string) {
  const ids = new Set(scheduleStore.employeesUsingTemplate(templateId))
  return employeesStore.items.filter((employee) => ids.has(employee.id))
}

function openCreate(): void {
  editing.value = null
  editorOpen.value = true
}

function openEdit(template: ScheduleTemplate): void {
  editing.value = template
  editorOpen.value = true
}

function duplicate(template: ScheduleTemplate): void {
  const copy = templatesStore.duplicate(template.id)
  if (!copy) {
    toast.error('Не удалось дублировать шаблон')
    return
  }
  toast.success('Шаблон скопирован', copy.name)
}

async function remove(template: ScheduleTemplate): Promise<void> {
  const usedBy = usedByEmployees(template.id)
  const assignmentCount = scheduleStore.countAssignmentsForTemplate(template.id)

  const ok = await confirm({
    title: 'Удалить шаблон?',
    message: `Шаблон «${template.name}» будет удалён без возможности восстановления.`,
    details:
      assignmentCount > 0
        ? [
            `Шаблон назначен ${usedBy.length} сотрудникам (назначений: ${assignmentCount}).`,
            'Все эти назначения также будут удалены, дни станут неразмеченными.',
            'Чтобы сохранить историю — сначала переназначьте сотрудников на другой шаблон.',
          ]
        : [`Цикл: ${template.segments.length} дн.`],
    confirmLabel: assignmentCount > 0 ? 'Удалить вместе с назначениями' : 'Удалить',
    danger: true,
  })
  if (!ok) return

  if (assignmentCount > 0) scheduleStore.removeAssignmentsForTemplate(template.id)
  templatesStore.remove(template.id)
  toast.success('Шаблон удалён', template.name)
}

async function resetPresets(): Promise<void> {
  const ok = await confirm({
    title: 'Вернуть встроенные пресеты?',
    message:
      'Циклы встроенных шаблонов (2/2, сутки через трое, 5/2 и другие) будут восстановлены к исходным.',
    details: [
      'Ваши собственные шаблоны останутся без изменений.',
      'Назначения сотрудников сохранятся: шаблоны обновляются на месте, а не создаются заново.',
    ],
    confirmLabel: 'Восстановить пресеты',
  })
  if (!ok) return
  templatesStore.resetPresets(todayISO())
  toast.success('Пресеты восстановлены', 'Встроенные шаблоны вернулись к исходным циклам')
}
</script>

<template>
  <div class="space-y-4">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Шаблоны графиков</h2>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          Создавайте произвольные циклические графики и назначайте их сотрудникам.
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <AppButton variant="secondary" size="sm" @click="resetPresets">
          <AppIcon name="refresh" :size="15" />
          Вернуть пресеты
        </AppButton>
        <AppButton variant="primary" size="sm" @click="openCreate">
          <AppIcon name="plus" :size="15" />
          Создать шаблон
        </AppButton>
      </div>
    </header>

    <EmptyState
      v-if="templates.length === 0"
      icon="layers"
      title="Шаблонов пока нет"
      description="Создайте первый шаблон сменного графика — например, «2 через 2» или «сутки через трое»."
    >
      <AppButton variant="primary" size="sm" @click="openCreate">
        <AppIcon name="plus" :size="15" />
        Создать шаблон
      </AppButton>
      <AppButton variant="secondary" size="sm" @click="resetPresets">
        <AppIcon name="refresh" :size="15" />
        Загрузить пресеты
      </AppButton>
    </EmptyState>

    <div v-else class="grid gap-3 xl:grid-cols-2">
      <TemplateCard
        v-for="template in templates"
        :key="template.id"
        :template="template"
        :used-by="usedByEmployees(template.id)"
        @edit="openEdit"
        @duplicate="duplicate"
        @remove="remove"
      />
    </div>

    <TemplateEditorModal v-model:open="editorOpen" :template="editing" />
  </div>
</template>
