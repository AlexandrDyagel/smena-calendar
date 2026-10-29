import type { ISODate, ScheduleTemplate, ShiftTypeCode, TemplateSegment } from '@/types'
import { createId, nowISO } from '@/utils/id'
import { getShiftMeta } from './shift-types'

/** Описание сегмента в пресете (без идентификатора — он создаётся при сборке). */
export interface PresetSegmentDefinition {
  type: ShiftTypeCode
  hours?: number
  label?: string
  note?: string
}

/** Определение встроенного шаблона. */
export interface PresetDefinition {
  key: string
  name: string
  description: string
  color: string
  segments: PresetSegmentDefinition[]
}

const WORK = (type: ShiftTypeCode, hours?: number): PresetSegmentDefinition => ({ type, hours })
const OFF: PresetSegmentDefinition = { type: 'OFF' }

/**
 * Обязательные пресеты из технического задания.
 * Любой из них пользователь может отредактировать или продублировать.
 */
export const PRESET_DEFINITIONS: PresetDefinition[] = [
  {
    key: 'two-by-two',
    name: '2 через 2',
    description: 'Два рабочих дня, затем два выходных. Классический сменный график.',
    color: '#16a34a',
    segments: [WORK('DAY', 12), WORK('DAY', 12), OFF, OFF],
  },
  {
    key: 'day-in-three',
    name: 'Сутки через трое',
    description: 'Одна суточная смена (24 часа), затем три выходных дня.',
    color: '#7c3aed',
    segments: [WORK('FULL', 24), OFF, OFF, OFF],
  },
  {
    key: 'every-other-day',
    name: 'День через день',
    description: 'Рабочий день чередуется с выходным.',
    color: '#0ea5e9',
    segments: [WORK('DAY', 12), OFF],
  },
  {
    key: 'five-two',
    name: '5/2 (пятидневка)',
    description: 'Пять рабочих дней и два выходных — стандартная рабочая неделя.',
    color: '#2563eb',
    segments: [
      WORK('DAY', 8),
      WORK('DAY', 8),
      WORK('DAY', 8),
      WORK('DAY', 8),
      WORK('DAY', 8),
      OFF,
      OFF,
    ],
  },
  {
    key: 'night-two-by-two',
    name: 'Ночные 2 через 2',
    description: 'Две ночные смены, затем два выходных.',
    color: '#1d4ed8',
    segments: [WORK('NIGHT', 12), WORK('NIGHT', 12), OFF, OFF],
  },
  {
    key: 'custom-mixed',
    name: 'Сложный смешанный цикл',
    description:
      'Сутки, выходной, снова сутки и пять выходных подряд. Демонстрирует произвольный цикл длиной 8 дней: С В С В В В В В.',
    color: '#db2777',
    // Цепочка цикла: С В С В В В В В
    segments: [WORK('FULL', 24), OFF, WORK('FULL', 24), OFF, OFF, OFF, OFF, OFF],
  },
]

/** Ключ пресета по умолчанию для быстрого создания. */
export const DEFAULT_PRESET_KEY = 'two-by-two'

/** Собирает сегменты пресета в полноценные сегменты шаблона. */
export function buildPresetSegments(definition: PresetDefinition): TemplateSegment[] {
  return definition.segments.map((segment) => {
    const meta = getShiftMeta(segment.type)
    return {
      id: createId('seg'),
      type: segment.type,
      hours: segment.hours ?? meta.defaultHours,
      ...(segment.label ? { label: segment.label } : {}),
      ...(segment.note ? { note: segment.note } : {}),
    }
  })
}

/**
 * Создаёт все встроенные шаблоны с уникальными идентификаторами.
 * Вызывается при первом запуске приложения (демо-данные).
 */
export function createPresetTemplates(startDate: ISODate, createdAt: string = nowISO()): ScheduleTemplate[] {
  return PRESET_DEFINITIONS.map((definition) => ({
    id: createId('tpl'),
    name: definition.name,
    description: definition.description,
    segments: buildPresetSegments(definition),
    startDate,
    color: definition.color,
    isPreset: true,
    createdAt,
    updatedAt: createdAt,
  }))
}
