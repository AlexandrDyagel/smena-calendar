<script setup lang="ts">
import { computed, ref } from 'vue'
import { getActivePinia } from 'pinia'
import { loadDemoData, resetAllData } from '@/app/bootstrap'
import { getPlatform, getRepository, isNativeApp, isPersistentStorage } from '@/services/repository'
import { collectAppData } from '@/services/persistence'
import { clearAppStorage, formatBytes, storageUsageBytes } from '@/utils/storage'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import ExportPanel from '@/components/export/ExportPanel.vue'
import ImportPanel from '@/components/export/ImportPanel.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppIcon from '@/components/ui/AppIcon.vue'

const { confirm } = useConfirm()
const toast = useToast()

const usage = ref(storageUsageBytes())
const persistent = isPersistentStorage()
const repository = getRepository()
const platform = getPlatform()
const native = isNativeApp()

/** Куда сохраняются данные на текущей платформе. */
const platformLabel = computed(() => {
  if (platform === 'android') return 'Android (APK)'
  if (platform === 'ios') return 'iOS'
  return 'Браузер'
})

const stats = computed(() => {
  const data = collectAppData()
  return {
    templates: data.templates.length,
    employees: data.employees.length,
    assignments: data.assignments.length,
    overrides: data.overrides.length,
    updatedAt: data.meta.updatedAt,
  }
})

function refreshUsage(): void {
  usage.value = storageUsageBytes()
}

async function loadDemo(): Promise<void> {
  const ok = await confirm({
    title: 'Загрузить демонстрационные данные?',
    message: 'Текущие шаблоны, работники и переопределения будут заменены демонстрационным набором.',
    details: [
      'Будет создано 6 шаблонов, 6 сотрудников, назначения и ручные переопределения.',
      'Текущие данные можно предварительно сохранить в JSON.',
    ],
    confirmLabel: 'Загрузить демо-данные',
    danger: true,
  })
  if (!ok) return

  const pinia = getActivePinia()
  if (!pinia) return
  await loadDemoData(pinia)
  refreshUsage()
  toast.success('Демо-данные загружены', 'Календарь заполнен на текущий месяц')
}

async function clearAll(): Promise<void> {
  const ok = await confirm({
    title: 'Удалить все данные?',
    message: 'Будут удалены все шаблоны, работники, назначения и переопределения.',
    details: [
      'Действие необратимо — восстановить данные можно только из сохранённой копии JSON.',
      'Настройки интерфейса (тема, фильтры) останутся без изменений.',
    ],
    confirmLabel: 'Удалить всё',
    danger: true,
  })
  if (!ok) return

  const pinia = getActivePinia()
  if (pinia) await resetAllData(pinia)
  clearAppStorage()
  refreshUsage()
  toast.success('Данные удалены', 'Приложение пустое — можно начать заново')
}
</script>

<template>
  <div class="space-y-4">
    <header>
      <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Экспорт, импорт и хранение</h2>
      <p class="text-sm text-slate-500 dark:text-slate-400">
        Данные хранятся только в вашем браузере. Регулярно сохраняйте резервную копию в JSON.
      </p>
    </header>

    <section
      class="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5 dark:border-slate-800 dark:bg-slate-900"
    >
      <div>
        <p class="text-[11px] uppercase tracking-wide text-slate-400">Платформа</p>
        <p class="text-sm font-medium text-slate-800 dark:text-slate-100">{{ platformLabel }}</p>
        <p class="text-xs text-slate-400">
          {{ native ? 'нативное приложение' : 'веб-версия' }}
        </p>
      </div>
      <div>
        <p class="text-[11px] uppercase tracking-wide text-slate-400">Хранилище</p>
        <p class="text-sm font-medium text-slate-800 dark:text-slate-100">
          {{ persistent ? repository.title : 'Память (временно)' }}
        </p>
        <p class="text-xs text-slate-400">
          {{ persistent ? `Занято: ${formatBytes(usage)}` : 'Данные исчезнут после закрытия' }}
        </p>
      </div>
      <div>
        <p class="text-[11px] uppercase tracking-wide text-slate-400">Шаблоны</p>
        <p class="text-sm font-medium text-slate-800 dark:text-slate-100">{{ stats.templates }}</p>
      </div>
      <div>
        <p class="text-[11px] uppercase tracking-wide text-slate-400">Работники</p>
        <p class="text-sm font-medium text-slate-800 dark:text-slate-100">{{ stats.employees }}</p>
      </div>
      <div>
        <p class="text-[11px] uppercase tracking-wide text-slate-400">Назначения</p>
        <p class="text-sm font-medium text-slate-800 dark:text-slate-100">{{ stats.assignments }}</p>
      </div>
      <div>
        <p class="text-[11px] uppercase tracking-wide text-slate-400">Ручные изменения</p>
        <p class="text-sm font-medium text-slate-800 dark:text-slate-100">{{ stats.overrides }}</p>
      </div>
    </section>

    <ExportPanel @export="refreshUsage" />
    <ImportPanel @imported="refreshUsage" />

    <section
      class="space-y-3 rounded-xl border border-red-200 bg-red-50/60 p-4 dark:border-red-500/30 dark:bg-red-500/5"
    >
      <h2 class="flex items-center gap-2 text-base font-semibold text-red-800 dark:text-red-300">
        <AppIcon name="alert" :size="18" />
        Опасная зона
      </h2>
      <p class="text-sm text-red-700 dark:text-red-300/80">
        Действия ниже необратимы. Перед их выполнением сохраните резервную копию в JSON.
      </p>
      <div class="flex flex-wrap items-center gap-2">
        <AppButton variant="secondary" size="sm" @click="loadDemo">
          <AppIcon name="refresh" :size="15" />
          Загрузить демо-данные
        </AppButton>
        <AppButton variant="danger" size="sm" @click="clearAll">
          <AppIcon name="trash" :size="15" />
          Удалить все данные
        </AppButton>
        <AppButton variant="ghost" size="sm" @click="refreshUsage">
          <AppIcon name="refresh" :size="15" />
          Обновить сведения о хранилище
        </AppButton>
      </div>
    </section>
  </div>
</template>
