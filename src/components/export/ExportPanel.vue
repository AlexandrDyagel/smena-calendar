<script setup lang="ts">
import { computed, ref } from 'vue'
import { useUiStore } from '@/stores/ui'
import { useEmployeesStore } from '@/stores/employees'
import { useTemplatesStore } from '@/stores/templates'
import { useCalendar } from '@/composables/useCalendar'
import { useToast } from '@/composables/useToast'
import { collectAppData } from '@/services/persistence'
import { APP_VERSION, SCHEMA_VERSION } from '@/services/migrations'
import { isNativeFileExport, saveTextFile } from '@/services/file-export'
import {
  buildIcs,
  buildJsonBundle,
  buildScheduleCsv,
  exportFilename,
} from '@/utils/export'
import { formatDateHuman, formatRangeTitle } from '@/utils/date'
import AppButton from '@/components/ui/AppButton.vue'
import AppIcon from '@/components/ui/AppIcon.vue'

const ui = useUiStore()
const employeesStore = useEmployeesStore()
const templatesStore = useTemplatesStore()
const { visibleEmployees, visibleCells, range } = useCalendar()
const toast = useToast()

/** Сообщаем родителю, что данные могли измениться (обновление сведений о хранилище). */
const emit = defineEmits<{ export: [] }>()

const includeOffDays = ref(false)

/** Отсортированные дни для экспорта: сначала по дате, затем по фамилии. */
const sortedCells = computed(() =>
  [...visibleCells.value].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1
    const first = employeesStore.nameOf(a.employeeId)
    const second = employeesStore.nameOf(b.employeeId)
    return first.localeCompare(second, 'ru')
  }),
)

const employeesById = computed(() => employeesStore.byId)
const templatesById = computed(() => templatesStore.byId)

const exportableCount = computed(() => sortedCells.value.length)

const rangeLabel = computed(() => formatRangeTitle(range.value.from, range.value.to))

function ensureData(): boolean {
  if (exportableCount.value === 0) {
    toast.warning(
      'Нечего экспортировать',
      'За выбранный период нет смен по текущим фильтрам. Измените период или фильтры в календаре.',
    )
    return false
  }
  return true
}

/** Показывает результат сохранения файла одинаково для телефона и браузера. */
function reportResult(filename: string, action: string, result: { ok: boolean; location?: string; error?: string }, count: number): void {
  if (result.ok) {
    toast.success(`${action} сохранён`, `${filename} · записей: ${count} → ${result.location ?? ''}`)
  } else {
    toast.error('Не удалось сохранить файл', result.error)
  }
  emit('export')
}

async function exportJson(): Promise<void> {
  const bundle = buildJsonBundle(collectAppData(), {
    app: 'smena-calendar',
    appVersion: APP_VERSION,
    schemaVersion: SCHEMA_VERSION,
  })
  const filename = exportFilename('smena-calendar-backup', 'json')
  const result = await saveTextFile(filename, bundle, 'application/json')
  if (result.ok) {
    toast.success('Резервная копия сохранена', `${filename} → ${result.location ?? ''}`)
  } else {
    toast.error('Не удалось сохранить копию', result.error)
  }
  emit('export')
}

async function exportCsv(): Promise<void> {
  if (!ensureData()) return
  const csv = buildScheduleCsv(sortedCells.value, employeesById.value, templatesById.value)
  const filename = exportFilename('shifts', 'csv', range.value)
  const result = await saveTextFile(filename, csv, 'text/csv')
  reportResult(filename, 'Расписание', result, exportableCount.value)
}

async function exportIcs(): Promise<void> {
  if (!ensureData()) return
  const ics = buildIcs(sortedCells.value, employeesById.value, {
    calendarName: `Смены ${rangeLabel.value}`,
    includeOffDays: includeOffDays.value,
  })
  const filename = exportFilename('shifts', 'ics', range.value)
  const result = await saveTextFile(filename, ics, 'text/calendar')
  reportResult(filename, 'Календарь iCal', result, exportableCount.value)
}

/** Подсказка о том, куда попадёт файл на текущей платформе. */
const saveHint = computed(() =>
  isNativeFileExport()
    ? 'Файл сохранится в «Документы» приложения, затем откроется системное окно «Поделиться».'
    : 'Файл скачается в папку загрузок браузера.',
)

const workOnlyCount = computed(
  () => sortedCells.value.filter((cell) => cell.source !== 'none' && cell.type !== 'OFF').length,
)
</script>

<template>
  <section
    class="space-y-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
  >
    <header>
      <h2 class="text-base font-semibold text-slate-900 dark:text-slate-100">Экспорт данных</h2>
      <p class="text-sm text-slate-500 dark:text-slate-400">
        Экспорт учитывает фильтры и период, выбранные в календаре.
      </p>
      <p class="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
        <AppIcon name="info" :size="13" />
        {{ saveHint }}
      </p>
    </header>

    <div
      class="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-800 dark:bg-slate-950/40"
    >
      <AppButton size="sm" variant="secondary" aria-label="Предыдущий период" @click="ui.previous()">
        <AppIcon name="chevronLeft" :size="15" />
      </AppButton>
      <AppButton size="sm" variant="secondary" aria-label="Следующий период" @click="ui.next()">
        <AppIcon name="chevronRight" :size="15" />
      </AppButton>
      <AppButton size="sm" variant="ghost" @click="ui.goToday()">Сегодня</AppButton>

      <span class="text-sm font-medium capitalize text-slate-700 dark:text-slate-200">
        {{ ui.periodTitle }}
      </span>

      <span class="ml-auto text-xs text-slate-500 dark:text-slate-400">
        период: {{ formatDateHuman(range.from) }} — {{ formatDateHuman(range.to) }} ·
        сотрудников: {{ visibleEmployees.length }} · строк: {{ exportableCount }}
      </span>
    </div>

    <div class="grid gap-3 md:grid-cols-3">
      <div class="space-y-2 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
        <div class="flex items-center gap-2">
          <AppIcon name="database" :size="16" class="text-blue-600 dark:text-blue-400" />
          <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-100">JSON (резервная копия)</h3>
        </div>
        <p class="text-xs text-slate-500 dark:text-slate-400">
          Полная конфигурация: шаблоны, работники, назначения, переопределения и настройки.
          Подходит для переноса данных на другое устройство.
        </p>
        <AppButton variant="primary" size="sm" block @click="exportJson">
          <AppIcon name="download" :size="15" />
          Скачать JSON
        </AppButton>
      </div>

      <div class="space-y-2 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
        <div class="flex items-center gap-2">
          <AppIcon name="list" :size="16" class="text-emerald-600 dark:text-emerald-400" />
          <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-100">CSV (расписание)</h3>
        </div>
        <p class="text-xs text-slate-500 dark:text-slate-400">
          Таблица «дата × сотрудник»: тип смены, часы, источник (шаблон или ручное изменение),
          комментарий. Открывается в Excel (разделитель «;», UTF-8 BOM).
        </p>
        <AppButton variant="secondary" size="sm" block @click="exportCsv">
          <AppIcon name="download" :size="15" />
          Скачать CSV
        </AppButton>
      </div>

      <div class="space-y-2 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
        <div class="flex items-center gap-2">
          <AppIcon name="calendar" :size="16" class="text-violet-600 dark:text-violet-400" />
          <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-100">iCal (.ics)</h3>
        </div>
        <p class="text-xs text-slate-500 dark:text-slate-400">
          Смены как события календаря — можно импортировать в Google Календарь, Outlook или
          Яндекс.Календарь.
        </p>
        <label class="flex cursor-pointer items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
          <input
            v-model="includeOffDays"
            type="checkbox"
            class="h-4 w-4 rounded border-slate-300 text-blue-600 dark:border-slate-600 dark:bg-slate-800"
          />
          включать нерабочие дни
        </label>
        <AppButton variant="secondary" size="sm" block @click="exportIcs">
          <AppIcon name="download" :size="15" />
          Скачать .ics
        </AppButton>
      </div>
    </div>

    <p
      v-if="exportableCount === 0"
      class="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
    >
      За выбранный период нет данных для экспорта. Проверьте период и фильтры в календаре.
    </p>
    <p v-else class="text-xs text-slate-400">
      Рабочих смен в выборке: {{ workOnlyCount }} из {{ exportableCount }} записей.
    </p>
  </section>
</template>
