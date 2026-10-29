<script setup lang="ts">
import { computed } from 'vue'
import type { ScheduleTemplate } from '@/types'
import { getShiftMeta } from '@/constants/shift-types'
import { formatDateHuman, pluralizeRu } from '@/utils/date'
import { withAlpha } from '@/utils/color'
import { shortName } from '@/utils/employee'
import type { Employee } from '@/types'
import AppBadge from '@/components/ui/AppBadge.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppIcon from '@/components/ui/AppIcon.vue'

const props = defineProps<{
  template: ScheduleTemplate
  /** Работники, у которых назначен этот шаблон. */
  usedBy: Employee[]
  /** Сколько дней цикла показывать в цепочке. */
  chainLimit?: number
}>()

const emit = defineEmits<{
  edit: [template: ScheduleTemplate]
  duplicate: [template: ScheduleTemplate]
  remove: [template: ScheduleTemplate]
}>()

const chain = computed(() => props.template.segments.slice(0, props.chainLimit ?? 16))
const restCount = computed(() => Math.max(0, props.template.segments.length - chain.value.length))

const totalHours = computed(() =>
  props.template.segments.reduce((sum, segment) => sum + (segment.hours || 0), 0),
)

const workShifts = computed(
  () => props.template.segments.filter((segment) => getShiftMeta(segment.type).isWork).length,
)
</script>

<template>
  <article
    class="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
  >
    <header class="flex items-start gap-3">
      <span
        class="mt-0.5 h-10 w-1.5 shrink-0 rounded-full"
        :style="{ backgroundColor: template.color ?? '#2563eb' }"
      />

      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <h3 class="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
            {{ template.name }}
          </h3>
          <AppBadge v-if="template.isPreset" label="пресет" color="#f59e0b" size="sm" />
          <AppBadge
            v-if="usedBy.length > 0"
            size="sm"
            color="#2563eb"
            :label="`используют: ${usedBy.length}`"
          />
          <AppBadge
            v-else
            size="sm"
            :label="'не используется'"
          />
        </div>

        <p v-if="template.description" class="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
          {{ template.description }}
        </p>
      </div>

      <div class="flex items-center gap-1">
        <AppButton size="sm" variant="ghost" title="Редактировать" @click="emit('edit', template)">
          <AppIcon name="pencil" :size="15" />
        </AppButton>
        <AppButton size="sm" variant="ghost" title="Дублировать" @click="emit('duplicate', template)">
          <AppIcon name="copy" :size="15" />
        </AppButton>
        <AppButton size="sm" variant="ghost" title="Удалить" @click="emit('remove', template)">
          <AppIcon name="trash" :size="15" class="text-red-500" />
        </AppButton>
      </div>
    </header>

    <div class="sc-scroll flex flex-wrap items-center gap-1 overflow-x-auto">
      <span
        v-for="segment in chain"
        :key="segment.id"
        class="flex h-7 min-w-7 items-center justify-center rounded-md border px-1 text-[11px] font-bold"
        :style="{
          backgroundColor: withAlpha(getShiftMeta(segment.type).color, 0.16),
          color: getShiftMeta(segment.type).color,
          borderColor: withAlpha(getShiftMeta(segment.type).color, 0.35),
        }"
        :title="`${getShiftMeta(segment.type).label}${segment.hours ? ` · ${segment.hours} ч` : ''}`"
      >
        {{ getShiftMeta(segment.type).shortLabel }}
      </span>
      <span v-if="restCount > 0" class="text-xs text-slate-400">+{{ restCount }}</span>
    </div>

    <dl class="grid grid-cols-2 gap-2 text-xs text-slate-500 sm:grid-cols-4 dark:text-slate-400">
      <div>
        <dt class="text-slate-400">Длина цикла</dt>
        <dd class="font-medium text-slate-700 dark:text-slate-200">
          {{ template.segments.length }}
          {{ pluralizeRu(template.segments.length, ['день', 'дня', 'дней']) }}
        </dd>
      </div>
      <div>
        <dt class="text-slate-400">Рабочих смен</dt>
        <dd class="font-medium text-slate-700 dark:text-slate-200">{{ workShifts }}</dd>
      </div>
      <div>
        <dt class="text-slate-400">Часов за цикл</dt>
        <dd class="font-medium text-slate-700 dark:text-slate-200">{{ totalHours }}</dd>
      </div>
      <div>
        <dt class="text-slate-400">Начало цикла</dt>
        <dd class="font-medium text-slate-700 dark:text-slate-200">
          {{ formatDateHuman(template.startDate) }}
        </dd>
      </div>
    </dl>

    <div v-if="usedBy.length > 0" class="flex flex-wrap items-center gap-1.5">
      <span class="text-xs text-slate-400">Назначен:</span>
      <span
        v-for="employee in usedBy.slice(0, 5)"
        :key="employee.id"
        class="rounded-md px-1.5 py-0.5 text-[11px] font-medium text-white"
        :style="{ backgroundColor: employee.color }"
        :title="`${employee.lastName} ${employee.firstName}`"
      >
        {{ shortName(employee) }}
      </span>
      <span v-if="usedBy.length > 5" class="text-[11px] text-slate-400">
        и ещё {{ usedBy.length - 5 }}
      </span>
    </div>
  </article>
</template>
