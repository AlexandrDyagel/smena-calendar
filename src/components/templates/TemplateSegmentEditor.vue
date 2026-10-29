<script setup lang="ts">
import { computed } from 'vue'
import type { TemplateSegment } from '@/types'
import { SHIFT_TYPE_LIST, getShiftMeta, normalizeHours } from '@/constants/shift-types'
import { withAlpha } from '@/utils/color'
import AppIcon from '@/components/ui/AppIcon.vue'
import AppSelect from '@/components/ui/AppSelect.vue'

const props = defineProps<{
  segment: TemplateSegment
  index: number
  total: number
}>()

const emit = defineEmits<{
  update: [segment: TemplateSegment]
  remove: [id: string]
  move: [id: string, direction: -1 | 1]
}>()

const meta = computed(() => getShiftMeta(props.segment.type))

const typeOptions = computed(() => SHIFT_TYPE_LIST.map((item) => ({ value: item.code, label: item.label })))

const chipStyle = computed(() => ({
  backgroundColor: withAlpha(meta.value.color, 0.16),
  color: meta.value.color,
  borderColor: withAlpha(meta.value.color, 0.4),
}))

function patch(changes: Partial<TemplateSegment>): void {
  emit('update', { ...props.segment, ...changes })
}

function changeType(value: string): void {
  const next = value as TemplateSegment['type']
  const item = getShiftMeta(next)
  patch({ type: next, hours: item.defaultHours })
}

function changeHours(value: string | number | undefined): void {
  patch({ hours: normalizeHours(props.segment.type, value) })
}
</script>

<template>
  <li
    class="rounded-xl border border-slate-200 p-3 transition-colors dark:border-slate-700"
    :style="{ backgroundColor: withAlpha(meta.color, 0.05) }"
  >
    <div class="flex flex-wrap items-center gap-2">
      <span
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-sm font-bold"
        :style="chipStyle"
        :title="meta.description"
      >
        {{ meta.shortLabel }}
      </span>

      <span class="text-xs text-slate-400">#{{ index + 1 }}</span>

      <div class="min-w-[150px] flex-1">
        <AppSelect
          :model-value="segment.type"
          :options="typeOptions"
          aria-label="Тип дня"
          @update:model-value="changeType"
        />
      </div>

      <div class="w-24">
        <input
          :value="segment.hours"
          type="number"
          min="0"
          max="24"
          step="0.5"
          :disabled="meta.isOff"
          class="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm disabled:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:disabled:bg-slate-800"
          aria-label="Часы"
          @input="changeHours(($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="flex items-center gap-0.5">
        <button
          type="button"
          class="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"
          :disabled="index === 0"
          title="Выше"
          aria-label="Переместить выше"
          @click="emit('move', segment.id, -1)"
        >
          <AppIcon name="chevronDown" :size="16" class="rotate-180" />
        </button>
        <button
          type="button"
          class="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"
          :disabled="index === total - 1"
          title="Ниже"
          aria-label="Переместить ниже"
          @click="emit('move', segment.id, 1)"
        >
          <AppIcon name="chevronDown" :size="16" />
        </button>
        <button
          type="button"
          class="rounded-lg p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
          title="Удалить элемент"
          aria-label="Удалить элемент"
          @click="emit('remove', segment.id)"
        >
          <AppIcon name="trash" :size="16" />
        </button>
      </div>
    </div>

    <div class="mt-2 grid gap-2 sm:grid-cols-2">
      <input
        :value="segment.label ?? ''"
        type="text"
        placeholder="Подпись (необязательно)"
        class="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        @input="patch({ label: ($event.target as HTMLInputElement).value })"
      />
      <input
        :value="segment.note ?? ''"
        type="text"
        placeholder="Комментарий к элементу"
        class="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        @input="patch({ note: ($event.target as HTMLInputElement).value })"
      />
    </div>
  </li>
</template>
