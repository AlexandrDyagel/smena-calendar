<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import type { Employee } from '@/types'
import { paletteColor } from '@/utils/color'
import { useEmployeesStore, type EmployeeDraft } from '@/stores/employees'
import { useToast } from '@/composables/useToast'
import AppButton from '@/components/ui/AppButton.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppModal from '@/components/ui/AppModal.vue'
import ColorSwatchPicker from '@/components/ui/ColorSwatchPicker.vue'

const props = defineProps<{
  /** null — создание нового работника. */
  employee: Employee | null
}>()

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ saved: [employee: Employee] }>()

const employeesStore = useEmployeesStore()
const toast = useToast()

const draft = reactive<EmployeeDraft>({
  firstName: '',
  lastName: '',
  middleName: '',
  position: '',
  department: '',
  color: paletteColor(0),
  active: true,
})

const touched = reactive({ firstName: false, lastName: false })

const firstNameError = computed(() =>
  touched.firstName && !draft.firstName.trim() ? 'Укажите имя' : '',
)
const lastNameError = computed(() =>
  touched.lastName && !draft.lastName.trim() ? 'Укажите фамилию' : '',
)

const isEdit = computed(() => Boolean(props.employee))

watch(
  () => [open.value, props.employee?.id] as const,
  ([isOpen]) => {
    if (!isOpen) return
    touched.firstName = false
    touched.lastName = false
    if (props.employee) {
      draft.firstName = props.employee.firstName
      draft.lastName = props.employee.lastName
      draft.middleName = props.employee.middleName ?? ''
      draft.position = props.employee.position ?? ''
      draft.department = props.employee.department ?? ''
      draft.color = props.employee.color
      draft.active = props.employee.active
    } else {
      draft.firstName = ''
      draft.lastName = ''
      draft.middleName = ''
      draft.position = ''
      draft.department = ''
      draft.color = paletteColor(employeesStore.items.length)
      draft.active = true
    }
  },
  { immediate: true },
)

function save(): void {
  touched.firstName = true
  touched.lastName = true
  if (firstNameError.value || lastNameError.value) return

  const saved = props.employee
    ? employeesStore.update(props.employee.id, { ...draft })
    : employeesStore.create({ ...draft })

  if (!saved) {
    toast.error('Не удалось сохранить работника')
    return
  }

  toast.success(
    props.employee ? 'Данные работника обновлены' : 'Работник добавлен',
    `${saved.lastName} ${saved.firstName}`,
  )
  emit('saved', saved)
  open.value = false
}
</script>

<template>
  <AppModal
    v-model:open="open"
    size="md"
    :title="isEdit ? 'Редактирование работника' : 'Новый работник'"
    subtitle="Отдел и должность используются для фильтров и группировки в отчётах"
  >
    <form class="space-y-4" @submit.prevent="save">
      <div class="grid gap-4 sm:grid-cols-2">
        <AppInput
          v-model="draft.lastName"
          label="Фамилия"
          required
          :error="lastNameError"
          @blur="touched.lastName = true"
        />
        <AppInput
          v-model="draft.firstName"
          label="Имя"
          required
          :error="firstNameError"
          @blur="touched.firstName = true"
        />
      </div>

      <AppInput v-model="draft.middleName" label="Отчество" />

      <div class="grid gap-4 sm:grid-cols-2">
        <AppInput v-model="draft.position" label="Должность" placeholder="Например: оператор" />

        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium text-slate-600 dark:text-slate-300" for="employee-department">
            Отдел
          </label>
          <input
            id="employee-department"
            v-model="draft.department"
            list="employee-departments"
            placeholder="Например: Диспетчерская"
            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          />
          <datalist id="employee-departments">
            <option v-for="department in employeesStore.departments" :key="department" :value="department" />
          </datalist>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            Можно выбрать существующий отдел или ввести новый
          </p>
        </div>
      </div>

      <ColorSwatchPicker v-model="draft.color" label="Цвет в календаре" />

      <label class="flex cursor-pointer items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
        <input
          v-model="draft.active"
          type="checkbox"
          class="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800"
        />
        Активный работник (участвует в расписании)
      </label>

      <p class="rounded-lg bg-slate-50 p-2 text-xs text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
        Если снять галочку, работник перейдёт в архив: история смен сохранится, но он перестанет
        отображаться в календаре, пока не включить «Показывать архивных сотрудников».
      </p>
    </form>

    <template #footer>
      <AppButton variant="secondary" @click="open = false">Отмена</AppButton>
      <AppButton variant="primary" @click="save">
        {{ isEdit ? 'Сохранить' : 'Добавить работника' }}
      </AppButton>
    </template>
  </AppModal>
</template>
