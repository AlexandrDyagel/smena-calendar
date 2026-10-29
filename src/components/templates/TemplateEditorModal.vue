<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import type { ISODate, ScheduleTemplate } from '@/types'
import { PRESET_DEFINITIONS, buildPresetSegments } from '@/constants/presets'
import { createSegment, describeSegments } from '@/constants/shift-types'
import { todayISO } from '@/utils/date'
import { useTemplatesStore } from '@/stores/templates'
import { useToast } from '@/composables/useToast'
import AppButton from '@/components/ui/AppButton.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppModal from '@/components/ui/AppModal.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import AppTextarea from '@/components/ui/AppTextarea.vue'
import ColorSwatchPicker from '@/components/ui/ColorSwatchPicker.vue'
import TemplateSegmentList from './TemplateSegmentList.vue'
import TemplatePreview from './TemplatePreview.vue'

const props = defineProps<{
  /** null — создание нового шаблона. */
  template: ScheduleTemplate | null
}>()

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ saved: [template: ScheduleTemplate] }>()

const templatesStore = useTemplatesStore()
const toast = useToast()

interface DraftState {
  name: string
  description: string
  color: string
  startDate: ISODate
  segments: ReturnType<typeof createSegment>[]
}

const draft = reactive<DraftState>({
  name: '',
  description: '',
  color: '#2563eb',
  startDate: todayISO(),
  segments: [],
})

const touched = reactive({ name: false, segments: false })

const presetOptions = computed(() => [
  { value: '', label: 'Заполнить из пресета…' },
  ...PRESET_DEFINITIONS.map((preset) => ({ value: preset.key, label: preset.name })),
])

const nameError = computed(() => (touched.name && !draft.name.trim() ? 'Укажите название шаблона' : ''))
const segmentsError = computed(() =>
  touched.segments && draft.segments.length === 0 ? 'Добавьте хотя бы один элемент цикла' : '',
)

const isEdit = computed(() => Boolean(props.template))

/** Сброс формы при открытии. */
watch(
  () => [open.value, props.template?.id] as const,
  ([isOpen]) => {
    if (!isOpen) return
    touched.name = false
    touched.segments = false
    if (props.template) {
      draft.name = props.template.name
      draft.description = props.template.description ?? ''
      draft.color = props.template.color ?? '#2563eb'
      draft.startDate = props.template.startDate
      draft.segments = props.template.segments.map((segment) => ({ ...segment }))
    } else {
      draft.name = ''
      draft.description = ''
      draft.color = '#2563eb'
      draft.startDate = todayISO()
      draft.segments = []
    }
  },
  { immediate: true },
)

function applyPreset(key: string): void {
  if (!key) return
  const definition = PRESET_DEFINITIONS.find((preset) => preset.key === key)
  if (!definition) return
  draft.segments = buildPresetSegments(definition)
  if (!draft.name.trim()) draft.name = definition.name
  if (!draft.description.trim()) draft.description = definition.description
  draft.color = definition.color
  toast.info('Пресет применён', 'Цикл шаблона заполнен — при необходимости измените элементы')
}

function save(): void {
  touched.name = true
  touched.segments = true
  if (nameError.value || segmentsError.value) return

  const payload = {
    name: draft.name.trim(),
    description: draft.description.trim(),
    color: draft.color,
    startDate: draft.startDate,
    segments: draft.segments.map((segment) => ({ ...segment })),
  }

  const saved = props.template
    ? templatesStore.update(props.template.id, payload)
    : templatesStore.create(payload)

  if (!saved) {
    toast.error('Не удалось сохранить шаблон')
    return
  }

  toast.success(
    props.template ? 'Шаблон обновлён' : 'Шаблон создан',
    `${saved.name} · ${describeSegments(saved.segments)}`,
  )
  emit('saved', saved)
  open.value = false
}
</script>

<template>
  <AppModal
    v-model:open="open"
    size="lg"
    :title="isEdit ? 'Редактирование шаблона' : 'Новый шаблон графика'"
    subtitle="Цикл повторяется бесконечно, начиная с даты начала применения у сотрудника"
  >
    <div class="space-y-5">
      <div class="grid gap-4 sm:grid-cols-2">
        <AppInput
          v-model="draft.name"
          label="Название"
          placeholder="Например: 2 через 2"
          required
          :error="nameError"
          @blur="touched.name = true"
        />
        <AppInput
          v-model="draft.startDate"
          type="date"
          label="Дата начала цикла"
          required
          hint="Используется как «нулевой день» при расчёте смен"
        />
      </div>

      <AppTextarea
        v-model="draft.description"
        label="Описание"
        placeholder="Коротко опишите график: сколько смен, сколько выходных"
        :rows="2"
      />

      <div class="grid gap-4 sm:grid-cols-2">
        <ColorSwatchPicker v-model="draft.color" label="Цвет шаблона" />
        <AppSelect
          v-if="!isEdit"
          :model-value="''"
          label="Быстрое заполнение"
          :options="presetOptions"
          hint="Создать цикл на основе готового пресета"
          @update:model-value="applyPreset"
        />
      </div>

      <hr class="border-slate-200 dark:border-slate-800" />

      <TemplateSegmentList v-model:segments="draft.segments" />

      <p v-if="segmentsError" class="text-xs text-red-600 dark:text-red-400">{{ segmentsError }}</p>

      <hr class="border-slate-200 dark:border-slate-800" />

      <TemplatePreview :segments="draft.segments" :start-date="draft.startDate" :days="14" />
    </div>

    <template #footer>
      <AppButton variant="secondary" @click="open = false">Отмена</AppButton>
      <AppButton variant="primary" @click="save">
        {{ isEdit ? 'Сохранить изменения' : 'Создать шаблон' }}
      </AppButton>
    </template>
  </AppModal>
</template>
