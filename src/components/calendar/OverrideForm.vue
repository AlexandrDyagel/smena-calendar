<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { ISODate, ShiftTypeCode } from '@/types'
import { SHIFT_TYPE_LIST, getShiftMeta } from '@/constants/shift-types'
import { formatDateHuman } from '@/utils/date'
import { useScheduleStore } from '@/stores/schedule'
import { useToast } from '@/composables/useToast'
import { feedback } from '@/services/feedback'
import AppButton from '@/components/ui/AppButton.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import AppTextarea from '@/components/ui/AppTextarea.vue'

const props = defineProps<{
  employeeId: string
  employeeName: string
  date: ISODate
}>()

const emit = defineEmits<{ saved: []; cancel: [] }>()

const scheduleStore = useScheduleStore()
const toast = useToast()

/** Существующее переопределение дня (если есть). */
const existing = computed(() => scheduleStore.overrideFor(props.employeeId, props.date))

/** Что рассчитано по шаблону — показываем как подсказку. */
const templateCell = computed(() => scheduleStore.resolveDay(props.employeeId, props.date))

const type = ref<ShiftTypeCode>(existing.value?.type ?? templateCell.value.type ?? 'DAY')
const hours = ref<number>(
  existing.value?.hours ?? templateCell.value.hours ?? getShiftMeta(type.value).defaultHours,
)
const reason = ref<string>(existing.value?.reason ?? '')

const typeOptions = computed(() =>
  SHIFT_TYPE_LIST.map((meta) => ({
    value: meta.code,
    label: `${meta.label}${meta.defaultHours ? ` (${meta.defaultHours} ч)` : ''}`,
  })),
)

const isOffType = computed(() => getShiftMeta(type.value).isOff)
const error = computed(() => {
  if (Number.isNaN(Number(hours.value)) || Number(hours.value) < 0) return 'Часы должны быть положительным числом'
  if (Number(hours.value) > 24) return 'Часы не могут превышать 24'
  return ''
})

// При смене типа подставляем часы по умолчанию из справочника.
watch(type, (next) => {
  hours.value = getShiftMeta(next).defaultHours
})

function save(): void {
  if (error.value) return
  scheduleStore.setOverride({
    employeeId: props.employeeId,
    date: props.date,
    type: type.value,
    hours: Number(hours.value),
    reason: reason.value,
  })
  void feedback('success')
  toast.success('День изменён вручную', `${props.employeeName} · ${formatDateHuman(props.date)}`)
  emit('saved')
}

function resetToTemplate(): void {
  scheduleStore.clearOverride(props.employeeId, props.date)
  void feedback('tap')
  toast.info('День возвращён к расчёту по шаблону')
  emit('saved')
}
</script>

<template>
  <form
    class="space-y-3 rounded-xl border border-blue-200 bg-blue-50/60 p-3 dark:border-blue-500/30 dark:bg-blue-500/10"
    @submit.prevent="save"
  >
    <div class="flex items-center justify-between">
      <h4 class="text-sm font-semibold text-slate-800 dark:text-slate-100">
        Переопределение дня
      </h4>
      <span class="text-xs text-slate-500 dark:text-slate-400">
        {{ formatDateHuman(date) }}
      </span>
    </div>

    <p v-if="templateCell.type" class="text-xs text-slate-500 dark:text-slate-400">
      По шаблону: <strong>{{ getShiftMeta(templateCell.type).label }}</strong>
      <span v-if="templateCell.templateName"> ({{ templateCell.templateName }})</span>,
      {{ templateCell.hours }} ч
    </p>
    <p v-else class="text-xs text-slate-500 dark:text-slate-400">
      По шаблону день не размечен — переопределение задаст смену явно.
    </p>

    <div class="grid gap-3 sm:grid-cols-2">
      <AppSelect v-model="type" label="Тип дня" :options="typeOptions" required />
      <AppInput
        v-model.number="hours"
        type="number"
        label="Часы"
        min="0"
        max="24"
        step="0.5"
        :disabled="isOffType"
        :error="error"
        :hint="isOffType ? 'Для нерабочих дней часы всегда 0' : 'Можно указать дробное значение'"
      />
    </div>

    <AppTextarea
      v-model="reason"
      label="Причина изменения"
      placeholder="Например: отгул за переработку, обмен сменами, больничный лист"
      :rows="2"
    />

    <div class="flex flex-wrap items-center gap-2">
      <AppButton type="submit" variant="primary" size="sm" :disabled="Boolean(error)">
        Сохранить
      </AppButton>
      <AppButton
        v-if="existing"
        type="button"
        variant="secondary"
        size="sm"
        @click="resetToTemplate"
      >
        Вернуть к шаблону
      </AppButton>
      <AppButton type="button" variant="ghost" size="sm" @click="emit('cancel')">Отмена</AppButton>
    </div>
  </form>
</template>
