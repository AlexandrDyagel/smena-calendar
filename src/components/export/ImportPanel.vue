<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ImportResult } from '@/types'
import { parseImportText } from '@/services/validation'
import { importAppData } from '@/app/bootstrap'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { readTextFile } from '@/utils/export'
import { getActivePinia } from 'pinia'
import AppButton from '@/components/ui/AppButton.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import AppTextarea from '@/components/ui/AppTextarea.vue'
import ErrorState from '@/components/ui/ErrorState.vue'

const { confirm } = useConfirm()
const toast = useToast()

const emit = defineEmits<{ imported: [] }>()

const fileInput = ref<HTMLInputElement | null>(null)
const rawText = ref('')
const parsed = ref<ImportResult | null>(null)
const error = ref<string | null>(null)
const fileName = ref<string>('')

const stats = computed(() => parsed.value?.stats ?? null)

function reset(): void {
  parsed.value = null
  error.value = null
}

function validate(text: string): void {
  error.value = null
  parsed.value = null
  if (!text.trim()) {
    error.value = 'Вставьте JSON или выберите файл'
    return
  }
  try {
    parsed.value = parseImportText(text)
  } catch (exception) {
    error.value = exception instanceof Error ? exception.message : 'Не удалось разобрать файл'
  }
}

async function onFileChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  fileName.value = file.name
  try {
    const text = await readTextFile(file)
    rawText.value = text
    validate(text)
  } catch {
    error.value = 'Не удалось прочитать файл'
  } finally {
    input.value = ''
  }
}

async function apply(): Promise<void> {
  if (!parsed.value) return
  const ok = await confirm({
    title: 'Импортировать данные?',
    message: 'Текущие шаблоны, работники, назначения и переопределения будут заменены.',
    details: [
      `Шаблонов: ${parsed.value.stats.templates}`,
      `Работников: ${parsed.value.stats.employees}`,
      `Назначений: ${parsed.value.stats.assignments}`,
      `Переопределений: ${parsed.value.stats.overrides}`,
      'Рекомендуется сначала сохранить резервную копию текущих данных.',
    ],
    confirmLabel: 'Импортировать',
    danger: true,
  })
  if (!ok) return

  const pinia = getActivePinia()
  if (!pinia) {
    toast.error('Не удалось применить данные', 'Внутренняя ошибка состояния приложения')
    return
  }

  await importAppData(parsed.value.data, pinia)
  toast.success('Данные импортированы', 'Проверьте календарь и назначения сотрудников')
  rawText.value = ''
  fileName.value = ''
  reset()
  emit('imported')
}
</script>

<template>
  <section
    class="space-y-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
  >
    <header>
      <h2 class="text-base font-semibold text-slate-900 dark:text-slate-100">Импорт данных из JSON</h2>
      <p class="text-sm text-slate-500 dark:text-slate-400">
        Поддерживается файл резервной копии, созданный этим приложением на любом устройстве.
      </p>
    </header>

    <div class="flex flex-wrap items-center gap-2">
      <input
        ref="fileInput"
        type="file"
        accept="application/json,.json"
        class="hidden"
        @change="onFileChange"
      />
      <AppButton variant="secondary" size="sm" @click="fileInput?.click()">
        <AppIcon name="upload" :size="15" />
        Выбрать файл
      </AppButton>
      <span v-if="fileName" class="text-xs text-slate-500 dark:text-slate-400">{{ fileName }}</span>
    </div>

    <AppTextarea
      v-model="rawText"
      label="Или вставьте JSON вручную"
      placeholder='{"app":"smena-calendar","data":{ ... }}'
      :rows="6"
      @update:model-value="reset"
    />

    <div class="flex flex-wrap items-center gap-2">
      <AppButton variant="primary" size="sm" @click="validate(rawText)">
        <AppIcon name="check" :size="15" />
        Проверить данные
      </AppButton>
      <AppButton v-if="parsed" variant="success" size="sm" @click="apply">
        <AppIcon name="upload" :size="15" />
        Импортировать и заменить
      </AppButton>
      <AppButton v-if="parsed || error" variant="ghost" size="sm" @click="reset">Очистить</AppButton>
    </div>

    <ErrorState v-if="error" title="Файл не подходит" :message="error" />

    <div
      v-if="stats"
      class="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm dark:border-emerald-500/30 dark:bg-emerald-500/10"
    >
      <p class="flex items-center gap-2 font-medium text-emerald-800 dark:text-emerald-300">
        <AppIcon name="check" :size="16" />
        Данные проверены — можно импортировать
      </p>
      <ul class="grid grid-cols-2 gap-1 text-xs text-emerald-800 sm:grid-cols-4 dark:text-emerald-200">
        <li>Шаблонов: <strong>{{ stats.templates }}</strong></li>
        <li>Работников: <strong>{{ stats.employees }}</strong></li>
        <li>Назначений: <strong>{{ stats.assignments }}</strong></li>
        <li>Переопределений: <strong>{{ stats.overrides }}</strong></li>
      </ul>

      <div v-if="parsed?.warnings.length" class="rounded-lg bg-white/70 p-2 dark:bg-slate-900/60">
        <p class="text-xs font-medium text-amber-700 dark:text-amber-300">
          Замечания при разборе ({{ parsed.warnings.length }}):
        </p>
        <ul class="sc-scroll mt-1 max-h-32 list-inside list-disc overflow-y-auto text-xs text-slate-600 dark:text-slate-300">
          <li v-for="warning in parsed.warnings" :key="warning">{{ warning }}</li>
        </ul>
      </div>
    </div>
  </section>
</template>
