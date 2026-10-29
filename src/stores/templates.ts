import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { ISODate, ScheduleTemplate, TemplateSegment } from '@/types'
import { createId, nowISO } from '@/utils/id'
import { cloneList, deepClone } from '@/utils/clone'
import { createSegment, normalizeHours } from '@/constants/shift-types'
import {
  PRESET_DEFINITIONS,
  buildPresetSegments,
  type PresetDefinition,
} from '@/constants/presets'
import { todayISO } from '@/utils/date'

/** Черновик шаблона, которым оперирует редактор. */
export interface TemplateDraft {
  name: string
  description: string
  color: string
  startDate: ISODate
  segments: TemplateSegment[]
}

/** Стор шаблонов сменных графиков. */
export const useTemplatesStore = defineStore('templates', () => {
  const items = ref<ScheduleTemplate[]>([])

  /** Все шаблоны. */
  const all = computed(() => items.value)

  /** Быстрый доступ по идентификатору. */
  const byId = computed(() => new Map(items.value.map((template) => [template.id, template] as const)))

  /** Шаблоны, отсортированные по названию. */
  const sorted = computed(() =>
    [...items.value].sort((a, b) => a.name.localeCompare(b.name, 'ru')),
  )

  /** Встроенные (демонстрационные) шаблоны. */
  const presets = computed(() => items.value.filter((template) => template.isPreset))

  /** Шаблоны, которые можно назначать (с непустым циклом). */
  const assignable = computed(() => items.value.filter((template) => template.segments.length > 0))

  /** Доступные пресеты для быстрого создания. */
  const presetDefinitions = computed<PresetDefinition[]>(() => PRESET_DEFINITIONS)

  /** Загружает список (используется при гидратации из хранилища). */
  function hydrate(list: ScheduleTemplate[]): void {
    items.value = cloneList(list)
  }

  /** Снимок для сохранения. */
  function snapshot(): ScheduleTemplate[] {
    return cloneList(items.value)
  }

  /** Шаблон по идентификатору. */
  function getById(id: string | null | undefined): ScheduleTemplate | undefined {
    if (!id) return undefined
    return byId.value.get(id)
  }

  /** Имя шаблона или понятная заглушка. */
  function nameOf(id: string | null | undefined): string {
    if (!id) return '—'
    return getById(id)?.name ?? 'Шаблон удалён'
  }

  /** Создаёт шаблон из черновика. */
  function create(draft: TemplateDraft, options: { isPreset?: boolean } = {}): ScheduleTemplate {
    const timestamp = nowISO()
    const template: ScheduleTemplate = {
      id: createId('tpl'),
      name: draft.name.trim() || 'Новый шаблон',
      description: draft.description.trim(),
      segments: cloneList(draft.segments),
      startDate: draft.startDate,
      color: draft.color,
      isPreset: options.isPreset ?? false,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    items.value = [...items.value, template]
    return template
  }

  /** Обновляет шаблон. Возвращает обновлённую запись либо null. */
  function update(id: string, patch: Partial<TemplateDraft>): ScheduleTemplate | null {
    const index = items.value.findIndex((template) => template.id === id)
    if (index === -1) return null
    const current = items.value[index]!
    const next: ScheduleTemplate = {
      ...current,
      ...(patch.name !== undefined ? { name: patch.name.trim() || current.name } : {}),
      ...(patch.description !== undefined ? { description: patch.description.trim() } : {}),
      ...(patch.color !== undefined ? { color: patch.color } : {}),
      ...(patch.startDate !== undefined ? { startDate: patch.startDate } : {}),
      ...(patch.segments !== undefined ? { segments: cloneList(patch.segments) } : {}),
      updatedAt: nowISO(),
    }
    const copy = [...items.value]
    copy[index] = next
    items.value = copy
    return next
  }

  /** Удаляет шаблон. Возвращает true, если запись была удалена. */
  function remove(id: string): boolean {
    const exists = items.value.some((template) => template.id === id)
    if (!exists) return false
    items.value = items.value.filter((template) => template.id !== id)
    return true
  }

  /** Создаёт копию шаблона. */
  function duplicate(id: string, nameSuffix = ' (копия)'): ScheduleTemplate | null {
    const source = getById(id)
    if (!source) return null
    const timestamp = nowISO()
    const copy: ScheduleTemplate = {
      ...deepClone(source),
      id: createId('tpl'),
      name: `${source.name}${nameSuffix}`,
      isPreset: false,
      segments: source.segments.map((segment) => ({ ...deepClone(segment), id: createId('seg') })),
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    items.value = [...items.value, copy]
    return copy
  }

  /** Создаёт шаблон из встроенного пресета. */
  function createFromPreset(key: string, startDate: ISODate = todayISO()): ScheduleTemplate | null {
    const definition = PRESET_DEFINITIONS.find((preset) => preset.key === key)
    if (!definition) return null
    const timestamp = nowISO()
    const template: ScheduleTemplate = {
      id: createId('tpl'),
      name: definition.name,
      description: definition.description,
      segments: buildPresetSegments(definition),
      startDate,
      color: definition.color,
      isPreset: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    items.value = [...items.value, template]
    return template
  }

  /**
   * Возвращает встроенные шаблоны к исходным циклам (кнопка «Вернуть пресеты»).
   *
   * Важно: у уже существующих пресетов сохраняется идентификатор, поэтому
   * назначения сотрудников продолжают ссылаться на те же шаблоны и не «повисают».
   * Собственные шаблоны пользователя не изменяются.
   */
  function resetPresets(startDate: ISODate = todayISO()): ScheduleTemplate[] {
    const timestamp = nowISO()
    const existingByName = new Map(
      items.value.filter((template) => template.isPreset).map((template) => [template.name, template]),
    )

    const restored: ScheduleTemplate[] = []
    const replacedIds = new Set<string>()

    for (const definition of PRESET_DEFINITIONS) {
      const segments = buildPresetSegments(definition)
      const existing = existingByName.get(definition.name)

      if (existing) {
        // Обновляем цикл «на месте»: идентификатор шаблона не меняется.
        replacedIds.add(existing.id)
        restored.push({
          ...existing,
          description: definition.description,
          color: definition.color,
          segments,
          updatedAt: timestamp,
        })
        continue
      }

      restored.push({
        id: createId('tpl'),
        name: definition.name,
        description: definition.description,
        segments,
        startDate,
        color: definition.color,
        isPreset: true,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
    }

    const untouched = items.value.filter((template) => !replacedIds.has(template.id))
    items.value = [...restored, ...untouched]
    return restored
  }

  /** Добавляет сегмент в конец цикла указанного шаблона. */
  function appendSegment(id: string, type: TemplateSegment['type'], hours?: number): boolean {
    const template = getById(id)
    if (!template) return false
    const segment = createSegment(type, hours === undefined ? {} : { hours: normalizeHours(type, hours) })
    return Boolean(update(id, { segments: [...template.segments, segment] }))
  }

  return {
    items,
    all,
    byId,
    sorted,
    presets,
    assignable,
    presetDefinitions,
    hydrate,
    snapshot,
    getById,
    nameOf,
    create,
    update,
    remove,
    duplicate,
    createFromPreset,
    resetPresets,
    appendSegment,
  }
})
