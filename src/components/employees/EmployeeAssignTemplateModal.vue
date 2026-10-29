<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import type { Employee, ISODate } from '@/types'
import { addDays, formatDateHuman, todayISO } from '@/utils/date'
import { useScheduleStore } from '@/stores/schedule'
import { useTemplatesStore } from '@/stores/templates'
import { useToast } from '@/composables/useToast'
import AppBadge from '@/components/ui/AppBadge.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppModal from '@/components/ui/AppModal.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import AppTextarea from '@/components/ui/AppTextarea.vue'

const props = defineProps<{
  employee: Employee | null
}>()

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ saved: [] }>()

const scheduleStore = useScheduleStore()
const templatesStore = useTemplatesStore()
const toast = useToast()

const draft = reactive<{
  templateId: string
  startDate: ISODate
  endDate: string
  comment: string
}>({
  templateId: '',
  startDate: todayISO(),
  endDate: '',
  comment: '',
})

const touched = reactive({ templateId: false, startDate: false })

const templateOptions = computed(() => [
  { value: '', label: 'Выберите шаблон…' },
  ...templatesStore.assignable.map((template) => ({
    value: template.id,
    label: `${template.name} (${template.segments.length} дн.)`,
  })),
])

const templateError = computed(() =>
  touched.templateId && !draft.templateId ? 'Выберите шаблон графика' : '',
)
const startDateError = computed(() =>
  touched.startDate && !draft.startDate ? 'Укажите дату начала' : '',
)
const rangeError = computed(() =>
  draft.endDate && draft.startDate && draft.endDate < draft.startDate
    ? 'Дата окончания не может быть раньше даты начала'
    : '',
)

/** История назначений работника. */
const history = computed(() =>
  props.employee ? scheduleStore.assignmentsForEmployee(props.employee.id) : [],
)

/** Действующее назначение на сегодня. */
const current = computed(() =>
  props.employee ? scheduleStore.currentAssignmentFor(props.employee.id, todayISO()) : null,
)

const willReplace = computed(() => {
  if (!props.employee) return false
  const open = history.value.find((assignment) => !assignment.endDate)
  if (!open) return false
  return open.startDate !== draft.startDate
})

watch(
  () => [open.value, props.employee?.id] as const,
  ([isOpen]) => {
    if (!isOpen) return
    touched.templateId = false
    touched.startDate = false
    draft.templateId = ''
    draft.startDate = todayISO()
    draft.endDate = ''
    draft.comment = ''
  },
  { immediate: true },
)

function save(): void {
  touched.templateId = true
  touched.startDate = true
  if (!props.employee) return
  if (templateError.value || startDateError.value || rangeError.value) return

  const result = scheduleStore.assignTemplate({
    employeeId: props.employee.id,
    templateId: draft.templateId,
    startDate: draft.startDate,
    endDate: draft.endDate || null,
    comment: draft.comment,
  })

  if (!result) {
    toast.error('Не удалось назначить шаблон', 'Проверьте выбранный шаблон и дату')
    return
  }

  toast.success(
    'Шаблон назначен',
    `${templatesStore.nameOf(draft.templateId)} с ${formatDateHuman(draft.startDate)}`,
  )
  emit('saved')
  open.value = false
}

function removeAssignment(id: string): void {
  scheduleStore.removeAssignment(id)
  toast.info('Назначение удалено')
  if (history.value.length === 0) open.value = false
}

/** Дата, с которой можно заменить текущее назначение (день после начала). */
const earliestReplacement = computed(() =>
  current.value ? addDays(current.value.startDate, 1) : todayISO(),
)
</script>

<template>
  <AppModal
    v-model:open="open"
    size="lg"
    title="Назначение шаблона графика"
    :subtitle="employee ? `${employee.lastName} ${employee.firstName} ${employee.middleName ?? ''}` : ''"
  >
    <div class="space-y-5">
      <div
        v-if="current"
        class="rounded-xl border border-blue-200 bg-blue-50/60 p-3 text-xs text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200"
      >
        <p class="font-medium">Текущий график</p>
        <p class="mt-1">
          {{ templatesStore.nameOf(current.templateId) }} — с
          {{ formatDateHuman(current.startDate) }}
          <span v-if="current.endDate">по {{ formatDateHuman(current.endDate) }}</span>
          <span v-else>(бессрочно)</span>
        </p>
        <p v-if="willReplace" class="mt-1">
          Новое назначение закроет текущее днём ранее: {{ formatDateHuman(addDays(draft.startDate, -1)) }}.
        </p>
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <AppSelect
          v-model="draft.templateId"
          label="Шаблон графика"
          required
          :options="templateOptions"
          :error="templateError"
          @update:model-value="touched.templateId = true"
        />
        <AppInput
          v-model="draft.startDate"
          type="date"
          label="Действует с"
          required
          :error="startDateError"
          hint="С этой даты цикл шаблона начинается заново"
        />
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <AppInput
          v-model="draft.endDate"
          type="date"
          label="Действует по (необязательно)"
          :error="rangeError"
          :hint="`Оставьте пустым для бессрочного назначения. Ближайшая замена возможна с ${formatDateHuman(earliestReplacement)}`"
        />
        <AppTextarea
          v-model="draft.comment"
          label="Комментарий"
          placeholder="Например: перевод на ночной график"
          :rows="2"
        />
      </div>

      <div class="border-t border-slate-200 pt-3 dark:border-slate-800">
        <h3 class="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
          История назначений
        </h3>

        <p v-if="history.length === 0" class="text-xs text-slate-500 dark:text-slate-400">
          Назначений пока нет — сотрудник в календаре отображается как «не размечено».
        </p>

        <ul v-else class="space-y-2">
          <li
            v-for="assignment in history"
            :key="assignment.id"
            class="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs dark:border-slate-800"
          >
            <span class="font-medium text-slate-700 dark:text-slate-200">
              {{ templatesStore.nameOf(assignment.templateId) }}
            </span>
            <span class="text-slate-500 dark:text-slate-400">
              {{ formatDateHuman(assignment.startDate) }} —
              {{ assignment.endDate ? formatDateHuman(assignment.endDate) : 'бессрочно' }}
            </span>
            <AppBadge v-if="!assignment.endDate" size="sm" color="#16a34a" label="активно" />
            <AppBadge v-if="assignment.comment" size="sm" :label="assignment.comment" />
            <AppButton
              class="ml-auto"
              size="sm"
              variant="ghost"
              title="Удалить назначение"
              @click="removeAssignment(assignment.id)"
            >
              Удалить
            </AppButton>
          </li>
        </ul>
      </div>
    </div>

    <template #footer>
      <AppButton variant="secondary" @click="open = false">Закрыть</AppButton>
      <AppButton variant="primary" :disabled="Boolean(rangeError)" @click="save">
        Назначить
      </AppButton>
    </template>
  </AppModal>
</template>
