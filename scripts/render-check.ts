/**
 * Проверка отрисовки всех экранов (SSR) и сохранения данных.
 * Запуск: npm run check:ui
 *
 * Заглушки браузерного окружения объявляются ДО первого обращения сторов к window.
 */
class MemoryStorage {
  private data = new Map<string, string>()
  get length(): number {
    return this.data.size
  }
  getItem(key: string): string | null {
    return this.data.has(key) ? (this.data.get(key) as string) : null
  }
  setItem(key: string, value: string): void {
    this.data.set(key, String(value))
  }
  removeItem(key: string): void {
    this.data.delete(key)
  }
  clear(): void {
    this.data.clear()
  }
  key(index: number): string | null {
    return [...this.data.keys()][index] ?? null
  }
}

const browserStorage = new MemoryStorage()

const globals = globalThis as unknown as Record<string, unknown>
globals.window = {
  localStorage: browserStorage,
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  addEventListener() {},
  removeEventListener() {},
  setTimeout: globalThis.setTimeout,
  clearTimeout: globalThis.clearTimeout,
}
globals.document = {
  documentElement: { classList: { toggle() {}, add() {}, remove() {} }, style: {} },
  title: '',
  body: { style: {} },
}

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createSSRApp, type Component } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { createPinia, type Pinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { applyAppData, persistNow } from '../src/services/persistence'
import { bootstrapData } from '../src/app/bootstrap'
import { SPLASH_FADE_MS } from '../src/services/splash'
import { createDemoData } from '../src/services/demo-data'
import { addDays, addMonths, endOfMonth, formatDateHuman, formatISO, monthNameRu, startOfMonth, todayISO } from '../src/utils/date'
import { STORAGE_KEYS } from '../src/utils/storage'
import CalendarView from '../src/views/CalendarView.vue'
import TemplatesView from '../src/views/TemplatesView.vue'
import EmployeesView from '../src/views/EmployeesView.vue'
import ReportsView from '../src/views/ReportsView.vue'
import DataView from '../src/views/DataView.vue'
import NotFoundView from '../src/views/NotFoundView.vue'
import ConfirmDialog from '../src/components/ui/ConfirmDialog.vue'
import EmployeeCard from '../src/components/employees/EmployeeCard.vue'
import EmployeeSchedulePreview from '../src/components/employees/EmployeeSchedulePreview.vue'
import EmployeeFormModal from '../src/components/employees/EmployeeFormModal.vue'
import EmployeeAssignTemplateModal from '../src/components/employees/EmployeeAssignTemplateModal.vue'
import TemplateEditorModal from '../src/components/templates/TemplateEditorModal.vue'
import { useConfirm } from '../src/composables/useConfirm'
import { useUiStore } from '../src/stores/ui'
import { useScheduleStore } from '../src/stores/schedule'
import { useReportsStore } from '../src/stores/reports'
import { useTemplatesStore } from '../src/stores/templates'
import type { AppData } from '../src/types/index.ts'

let passed = 0
let failed = 0

function succeed(title: string): void {
  passed += 1
  console.log(`  ok   ${title}`)
}

function fail(title: string, reason: string): void {
  failed += 1
  console.error(`  FAIL ${title}`)
  console.error(`       ${reason}`)
}

function check(title: string, html: string, expectations: Array<string | RegExp>): void {
  for (const expected of expectations) {
    const matched =
      typeof expected === 'string' ? html.includes(expected) : expected.test(html)
    if (!matched) {
      fail(title, `не найдено: ${String(expected)}`)
      return
    }
  }
  succeed(title)
}

function expect(title: string, condition: boolean, reason: string): void {
  if (condition) succeed(title)
  else fail(title, reason)
}

async function render(
  component: Component,
  pinia: Pinia,
  props?: Record<string, unknown>,
): Promise<string> {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:all(.*)', component: { template: '<div />' } }],
  })
  const app = createSSRApp(component, props)
  app.use(pinia)
  app.use(router)
  await router.push('/calendar')
  await router.isReady()

  // Модальные окна и боковые панели отрисовываются через Teleport,
  // поэтому их содержимое приходит отдельно от основной разметки.
  const context: { teleports?: Record<string, string> } = {}
  const html = await renderToString(app, context)
  const teleported = context.teleports ? Object.values(context.teleports).join('') : ''
  return html + teleported
}

/** Новый набор данных. Настройки интерфейса сбрасываются, чтобы проверки не влияли друг на друга. */
function freshPinia(): { pinia: Pinia; data: AppData } {
  browserStorage.clear()
  const data = createDemoData()
  const pinia = createPinia()
  applyAppData(data, pinia)
  useUiStore(pinia).setViewMode('month')
  return { pinia, data }
}

const TOOLTIP_MARKER = 'Нажмите, чтобы открыть детали дня'

/** Компактное имя так же, как его строит утилита shortName. */
function shortNameOf(employee: {
  lastName: string
  firstName: string
  middleName?: string
}): string {
  const initials = [employee.firstName, employee.middleName]
    .filter((part): part is string => Boolean(part))
    .map((part) => `${part.charAt(0).toUpperCase()}.`)
    .join(' ')
  return `${employee.lastName} ${initials}`
}

console.log('\nОтрисовка экранов (SSR)')

const calendar = freshPinia()
const calendarHtml = await render(CalendarView, calendar.pinia)
check('Календарь: период, легенда, фильтры, сотрудники, типы смен', calendarHtml, [
  'Легенда смен',
  'Фильтры',
  'Дневная смена',
  'Отпуск',
  'Больничный',
])

const cellCount = (calendarHtml.match(new RegExp(TOOLTIP_MARKER, 'g')) ?? []).length
expect('Календарь: сетка месяца = 42 ячейки', cellCount === 42, `получено ячеек: ${cellCount}`)

expect(
  'Календарь: видны ручные изменения',
  calendarHtml.includes('(вручную)'),
  'не найдена пометка ручного изменения',
)

expect(
  'Календарь: сегодняшний день подсвечен',
  calendarHtml.includes('ring-2 ring-inset ring-blue-500'),
  'нет подсветки сегодняшнего дня',
)

/** Иванов работает по графику 2/2 → в подсказках видны и смены, и выходные. */
const ivanov = shortNameOf(calendar.data.employees[0]!)
expect(
  'Календарь: подсказки дней содержат русские названия смен',
  calendarHtml.includes(`${ivanov} — Дневная смена`) &&
    calendarHtml.includes(`${ivanov} — Выходной`),
  'в подсказках нет дневных смен и выходных Иванова',
)

const templatesHtml = await render(TemplatesView, freshPinia().pinia)
check('Шаблоны: пресеты, цепочка цикла, использование', templatesHtml, [
  'Шаблоны графиков',
  '2 через 2',
  'Сутки через трое',
  'День через день',
  '5/2 (пятидневка)',
  'Сложный смешанный цикл',
  'Создать шаблон',
  'используют:',
  'Часов за цикл',
  'Назначен:',
])

const employeesHtml = await render(EmployeesView, freshPinia().pinia)
check('Работники: список, отделы, текущий график', employeesHtml, [
  'Работники',
  'Добавить работника',
  'Иванов Иван Иванович',
  'Кузнецова Мария Игоревна',
  'Электрик',
  'Электрики',
  'График:',
  'Ручных изменений',
  'Выберите сотрудника',
])

/** Набор отделов должен состоять ровно из трёх значений. */
check('Отделы: Диспетчерская, Электрики, Слесаря', calendarHtml, [
  'Диспетчерская',
  'Электрики',
  'Слесаря',
])
expect(
  'Отделы: прежние названия удалены',
  ['Служба доставки', 'Служба безопасности', 'Медицинский пункт', 'Техническая служба'].every(
    (old) => !calendarHtml.includes(old),
  ),
  'в списке отделов остались старые названия',
)

const reportsHtml = await render(ReportsView, freshPinia().pinia)
check('Отчёты: итоги, сводная таблица, группировка', reportsHtml, [
  'Отчёты по сменам и часам',
  'Рабочих смен',
  'Часов всего',
  'Дневных',
  'Ночных',
  'Суточных',
  'Выходных по графику',
  'Отпуск',
  'Больничный',
  'Итого',
  'Группировка по типам смен',
])

const dataHtml = await render(DataView, freshPinia().pinia)
check('Данные: экспорт, импорт, опасная зона', dataHtml, [
  'Экспорт, импорт и хранение',
  'Экспорт данных',
  'JSON (резервная копия)',
  'CSV (расписание)',
  'iCal (.ics)',
  'Импорт данных из JSON',
  'Опасная зона',
  'Удалить все данные',
])

const notFoundHtml = await render(NotFoundView, freshPinia().pinia)
check('Страница 404', notFoundHtml, ['Страница не найдена', 'Вернуться в календарь'])

/** Панель деталей дня: открываем день с ручным переопределением. */
const drawer = freshPinia()
const overrideDate = drawer.data.overrides[0]!.date
useUiStore(drawer.pinia).openDay(overrideDate)
const drawerHtml = await render(CalendarView, drawer.pinia)
check('Панель дня: детали, источник, причина изменения', drawerHtml, [
  formatISO(overrideDate, 'D MMMM YYYY'),
  'Детали дня',
  'Изменено вручную',
  'Источник:',
  /Отгул|отпуск|Обмен|Больничный/,
])

/** Режим «Неделя». */
const week = freshPinia()
useUiStore(week.pinia).setViewMode('week')
const weekHtml = await render(CalendarView, week.pinia)
check('Режим «Неделя»: таблица сотрудник × день', weekHtml, [
  'Сотрудник',
  /понедельник|вторник|среда|четверг|пятница|суббота|воскресенье/,
  'Иванов И.',
])

/** Режим «Список». */
const list = freshPinia()
useUiStore(list.pinia).setViewMode('list')
const listHtml = await render(CalendarView, list.pinia)
check('Режим «Список»: строки с источником и шаблоном', listHtml, [
  'Источник',
  'Шаблон',
  'Комментарий',
  'По шаблону',
  'Изменено вручную',
])

/** Пустое состояние. */
const emptyHtml = await render(CalendarView, createPinia())
check('Пустое состояние без данных', emptyHtml, ['Данных пока нет', 'Перейти к шаблонам'])

/** Фильтр «только рабочие смены». */
const filtered = freshPinia()
const filteredUi = useUiStore(filtered.pinia)
filteredUi.setOnlyWorkDays(true)
const filteredHtml = await render(CalendarView, filtered.pinia)
const filteredCells = (filteredHtml.match(new RegExp(TOOLTIP_MARKER, 'g')) ?? []).length
expect('Фильтр «только рабочие смены»: сетка сохраняется', filteredCells === 42, `ячеек: ${filteredCells}`)
expect(
  'Фильтр «только рабочие смены»: выходные скрыты',
  filteredHtml.includes('Нет смен по выбранным фильтрам'),
  'нет ячеек без смен — фильтр не применился',
)

/** Фильтр по одному сотруднику: в подсказках остаётся только он. */
const single = freshPinia()
const firstEmployee = single.data.employees[0]!
useUiStore(single.pinia).setEmployees([firstEmployee.id])
const singleHtml = await render(CalendarView, single.pinia)
const firstName = `${shortNameOf(firstEmployee)} — `
const otherEmployee = single.data.employees[2]!
const otherName = `${shortNameOf(otherEmployee)} — `
expect(
  'Фильтр по сотруднику: показан выбранный',
  singleHtml.includes(firstName),
  `в подсказках нет «${firstName}»`,
)
expect(
  'Фильтр по сотруднику: остальные скрыты',
  !singleHtml.includes(otherName),
  `в подсказках остался «${otherName}»`,
)

/** Фильтр по отделу. */
const byDepartment = freshPinia()
useUiStore(byDepartment.pinia).filters.departments = ['Электрики']
const departmentHtml = await render(CalendarView, byDepartment.pinia)
const electrician = byDepartment.data.employees[0]!
const dispatcher = byDepartment.data.employees[1]!
expect(
  'Фильтр по отделу: остаются только сотрудники отдела',
  departmentHtml.includes(`${shortNameOf(electrician)} — `) &&
    !departmentHtml.includes(`${shortNameOf(dispatcher)} — `),
  'фильтр по отделу не сработал',
)

console.log('\nМодальные окна: кнопки действий')

/**
 * Регрессия: окна с собственным футером (подтверждение, формы, редактор шаблона)
 * однажды отрисовывались без кнопок — футер скрывался вместе со слотом.
 */
const confirmDialogs = useConfirm()
void confirmDialogs.confirm({
  title: 'Удалить работника полностью?',
  message: 'Иванов Иван будет удалён вместе со своей историей смен.',
  details: ['Назначений шаблона: 1', 'Ручных переопределений: 2'],
  confirmLabel: 'Удалить навсегда',
  danger: true,
})
const confirmHtml = await render(ConfirmDialog, freshPinia().pinia)
check('Диалог подтверждения: заголовок, пояснения, кнопки', confirmHtml, [
  'Удалить работника полностью?',
  'Назначений шаблона: 1',
  'Ручных переопределений: 2',
  'Отмена',
  'Удалить навсегда',
])
confirmDialogs.cancel()

const employeeFormHtml = await render(EmployeeFormModal, freshPinia().pinia, {
  open: true,
  employee: null,
})
check('Форма работника: поля и кнопки', employeeFormHtml, [
  'Новый работник',
  'Фамилия',
  'Имя',
  'Активный работник',
  'Отмена',
  'Добавить работника',
])

const assign = freshPinia()
const assignHtml = await render(EmployeeAssignTemplateModal, assign.pinia, {
  open: true,
  employee: assign.data.employees[0],
})
check('Назначение шаблона: форма и кнопки', assignHtml, [
  'Назначение шаблона графика',
  'Шаблон графика',
  'Действует с',
  'История назначений',
  'Закрыть',
  'Назначить',
])

const templateEditorHtml = await render(TemplateEditorModal, freshPinia().pinia, {
  open: true,
  template: null,
})
check('Редактор шаблона (создание): конструктор и кнопки', templateEditorHtml, [
  'Новый шаблон графика',
  'Цикл шаблона',
  'Добавить элемент в конец цикла',
  'Предпросмотр',
  'Отмена',
  'Создать шаблон',
])

const editTemplate = freshPinia()
const editTemplateHtml = await render(TemplateEditorModal, editTemplate.pinia, {
  open: true,
  template: editTemplate.data.templates[0],
})
check('Редактор шаблона (правка): загруженный цикл и кнопки', editTemplateHtml, [
  'Редактирование шаблона',
  'Сохранить изменения',
  'Дублировать последний',
])

console.log('\nВосстановление пресетов')

/**
 * Регрессия: «Вернуть пресеты» пересоздавало шаблоны с новыми идентификаторами,
 * из-за чего назначения сотрудников ссылались на удалённые шаблоны.
 */
const reset = freshPinia()
const resetTemplates = useTemplatesStore(reset.pinia)
const usedTemplateIds = [...new Set(reset.data.assignments.map((item) => item.templateId))]
resetTemplates.resetPresets(todayISO())

const lostTemplates = usedTemplateIds.filter((id) => !resetTemplates.getById(id))
expect(
  'Возврат пресетов сохраняет шаблоны, назначенные сотрудникам',
  lostTemplates.length === 0,
  `потеряно шаблонов: ${lostTemplates.length}`,
)

const mixed = resetTemplates.items.find((template) => template.name === 'Сложный смешанный цикл')
const mixedTypes = mixed ? mixed.segments.map((segment) => segment.type).join(',') : 'нет шаблона'
expect(
  'Возврат пресетов восстанавливает цикл С В С В В В В В',
  mixedTypes === 'FULL,OFF,FULL,OFF,OFF,OFF,OFF,OFF',
  `получено: ${mixedTypes}`,
)

const ownTemplate = resetTemplates.create({
  name: 'Собственный график',
  description: '',
  color: '#123456',
  startDate: todayISO(),
  segments: [{ id: 's1', type: 'DAY', hours: 8 }],
})
resetTemplates.resetPresets(todayISO())
expect(
  'Возврат пресетов не трогает собственные шаблоны',
  resetTemplates.getById(ownTemplate.id)?.name === 'Собственный график',
  'собственный шаблон пропал',
)

console.log('\nСценарий: шаблон назначен с будущей даты')

/**
 * Регрессия: при назначении шаблона с будущей даты карточка писала «Шаблон не назначен»,
 * а индивидуальный календарь открывался на текущем месяце, где смен ещё нет.
 */
const future = freshPinia()
const futureEmployee = future.data.employees[1]!
const futureTemplate = future.data.templates[0]!
const futureStart = addDays(todayISO(), 10)

// Повторяем действия пользователя: у сотрудника не было графика, назначаем с будущей даты.
const futureSchedule = useScheduleStore(future.pinia)
for (const assignment of futureSchedule.assignmentsForEmployee(futureEmployee.id)) {
  futureSchedule.removeAssignment(assignment.id)
}
futureSchedule.assignTemplate({
  employeeId: futureEmployee.id,
  templateId: futureTemplate.id,
  startDate: futureStart,
})

const futureCardHtml = await render(EmployeeCard, future.pinia, {
  employee: futureEmployee,
  selected: false,
})
check('Карточка работника: будущий график показан с датой начала', futureCardHtml, [
  'График:',
  'начнётся',
  formatDateHuman(futureStart),
  futureTemplate.name,
])
expect(
  'Карточка работника: нет ложного «Шаблон не назначен»',
  !futureCardHtml.includes('Шаблон не назначен'),
  'карточка сообщает, что шаблон не назначен',
)

const futurePreviewHtml = await render(EmployeeSchedulePreview, future.pinia, {
  employeeId: futureEmployee.id,
})
const [futureYear, futureMonth] = futureStart.split('-')
check('Индивидуальный календарь: открыт месяц начала графика', futurePreviewHtml, [
  `${monthNameRu(Number(futureMonth))} ${futureYear}`,
  'начнётся',
  futureTemplate.name,
])

const futureChips = (futurePreviewHtml.match(/text-\[10px\] font-bold/g) ?? []).length
expect(
  'Индивидуальный календарь: смены в месяце начала графика видны',
  futureChips > 0,
  `найдено смен в сетке: ${futureChips}`,
)

/** Действующий график по-прежнему открывается на текущем месяце. */
const activePreviewHtml = await render(EmployeeSchedulePreview, calendar.pinia, {
  employeeId: calendar.data.employees[0]!.id,
})
check('Индивидуальный календарь: действующий график открыт на текущем месяце', activePreviewHtml, [
  'Действующий график:',
  `${monthNameRu(Number(todayISO().slice(5, 7)))} ${todayISO().slice(0, 4)}`,
])

/** Завершённый график: пустой календарь должен быть объяснён. */
const ended = freshPinia()
const endedEmployee = ended.data.employees[3]!
const endedSchedule = useScheduleStore(ended.pinia)
for (const assignment of endedSchedule.assignmentsForEmployee(endedEmployee.id)) {
  endedSchedule.removeAssignment(assignment.id)
}
const endedAt = addDays(todayISO(), -5)
endedSchedule.assignTemplate({
  employeeId: endedEmployee.id,
  templateId: ended.data.templates[0]!.id,
  startDate: addDays(todayISO(), -30),
  endDate: endedAt,
})
const endedHtml = await render(EmployeeSchedulePreview, ended.pinia, {
  employeeId: endedEmployee.id,
})
check('Индивидуальный календарь: завершённый график объяснён', endedHtml, [
  'График не действует',
  formatDateHuman(endedAt),
  'Назначьте новый шаблон',
])

/** Сотрудник без назначений: явная подсказка вместо пустого экрана. */
const noAssignments = freshPinia()
const noAssignmentsSchedule = useScheduleStore(noAssignments.pinia)
const bareEmployee = noAssignments.data.employees[4]!
for (const assignment of noAssignmentsSchedule.assignmentsForEmployee(bareEmployee.id)) {
  noAssignmentsSchedule.removeAssignment(assignment.id)
}
const bareCardHtml = await render(EmployeeCard, noAssignments.pinia, {
  employee: bareEmployee,
  selected: false,
})
check('Карточка работника без графика: честное «Шаблон не назначен»', bareCardHtml, [
  'Шаблон не назначен',
])

const barePreviewHtml = await render(EmployeeSchedulePreview, noAssignments.pinia, {
  employeeId: bareEmployee.id,
})
check('Индивидуальный календарь без графика: подсказка о назначении', barePreviewHtml, [
  'Шаблон графика не назначен',
  'Назначить шаблон',
])

console.log('\nОтчёты: переключение периодов')

/**
 * Регрессия: переключение «Год → Месяц» брало началом диапазона 1 января,
 * поэтому отчёт показывал нули до перезагрузки страницы.
 */
const reportSwitch = freshPinia()
const reportsStore = useReportsStore(reportSwitch.pinia)
const monthStart = startOfMonth(todayISO())
const monthEnd = endOfMonth(todayISO())
const yearStart = `${todayISO().slice(0, 4)}-01-01`

expect(
  'Отчёт по умолчанию — текущий месяц',
  reportsStore.period.from === monthStart && reportsStore.period.to === monthEnd,
  `период: ${reportsStore.period.from} — ${reportsStore.period.to}`,
)

reportsStore.setPreset('year')
expect(
  'Год: с 1 января по 31 декабря',
  reportsStore.period.from === yearStart && reportsStore.period.to.endsWith('-12-31'),
  `период: ${reportsStore.period.from} — ${reportsStore.period.to}`,
)

reportsStore.setPreset('month')
expect(
  'После «Года» месяц возвращается к текущему, а не к январю',
  reportsStore.period.from === monthStart && reportsStore.period.to === monthEnd,
  `период: ${reportsStore.period.from} — ${reportsStore.period.to}`,
)
expect(
  'Отчёт за месяц после переключения заполнен (часы и смены)',
  reportsStore.report.totals.hoursTotal > 0 && reportsStore.report.totals.workShifts > 0,
  `часов: ${reportsStore.report.totals.hoursTotal}, смен: ${reportsStore.report.totals.workShifts}`,
)

reportsStore.setPreset('year')
reportsStore.setPreset('quarter')
expect(
  'После «Года» квартал содержит текущий месяц',
  reportsStore.period.from <= monthStart && reportsStore.period.to >= monthEnd,
  `период: ${reportsStore.period.from} — ${reportsStore.period.to}`,
)
expect(
  'Отчёт за квартал после переключения заполнен',
  reportsStore.report.totals.hoursTotal > 0,
  `часов: ${reportsStore.report.totals.hoursTotal}`,
)

reportsStore.setPreset('month')
reportsStore.shiftPeriod(-1)
expect(
  'Сдвиг периода назад показывает предыдущий месяц',
  reportsStore.period.from === startOfMonth(addMonths(monthStart, -1)),
  `период: ${reportsStore.period.from}`,
)

reportsStore.setBoundary('from', '2026-01-01')
expect(
  'Ручная граница делает период произвольным и запоминает точку отсчёта',
  reportsStore.preset === 'custom' &&
    reportsStore.period.from === '2026-01-01' &&
    reportsStore.anchorDate === '2026-01-01',
  `preset: ${reportsStore.preset}, from: ${reportsStore.period.from}`,
)
reportsStore.setPreset('month')
expect(
  'Месяц после ручной границы считается от неё',
  reportsStore.period.from === '2026-01-01' && reportsStore.period.to === '2026-01-31',
  `период: ${reportsStore.period.from} — ${reportsStore.period.to}`,
)

console.log('\nОболочка запуска: заставка')

/** Заставка живёт в index.html, поэтому проверяем её как часть оболочки. */
const indexHtml = readFileSync(join(process.cwd(), 'index.html'), 'utf8')

expect(
  'Заставка есть в HTML и содержит название приложения',
  indexHtml.includes('id="app-splash"') && indexHtml.includes('Календарь смен'),
  'в index.html нет заставки с названием',
)
expect(
  'Логотип заставки «дышит»',
  indexHtml.includes('@keyframes app-splash-breathe') &&
    indexHtml.includes('animation: app-splash-breathe'),
  'нет анимации дыхания логотипа',
)
expect(
  'Учитывается системная настройка «уменьшить движение»',
  indexHtml.includes('@media (prefers-reduced-motion: reduce)'),
  'нет поддержки prefers-reduced-motion',
)
expect(
  'Есть страховка от «залипшей» заставки',
  /app-splash--hidden[\s\S]{0,200}\}, 8000\)/.test(indexHtml),
  'нет таймаута, который убирает заставку при ошибке загрузки',
)
expect(
  'Заставка рисуется до бандла (стили в HTML, а не в CSS-файле)',
  indexHtml.includes('<style>') && indexHtml.includes('.app-splash__logo'),
  'стили заставки не встроены в HTML',
)

/** Время затухания в CSS и в коде должно совпадать, иначе будет рывок. */
const fadeMatch = indexHtml.match(/transition:\s*opacity\s*([\d.]+)s/)
const cssFadeMs = fadeMatch ? Math.round(Number(fadeMatch[1]) * 1000) : 0
expect(
  'Длительность затухания совпадает с кодом скрытия',
  cssFadeMs === SPLASH_FADE_MS,
  `в CSS ${cssFadeMs} мс, в коде ${SPLASH_FADE_MS} мс`,
)

console.log('\nСохранение данных')

/** Изменяем данные, сохраняем и загружаем заново — данные должны восстановиться. */
const persistence = freshPinia()
const templatesStore = useTemplatesStore(persistence.pinia)
const created = templatesStore.create({
  name: 'Проверочный шаблон',
  description: 'создан в проверке',
  color: '#123456',
  startDate: todayISO(),
  segments: [
    { id: 'seg-a', type: 'NIGHT', hours: 12 },
    { id: 'seg-b', type: 'OFF', hours: 0 },
  ],
})
await persistNow(persistence.pinia)

const stored = browserStorage.getItem(STORAGE_KEYS.data)
expect('Данные записаны в хранилище', Boolean(stored), 'ключ данных пуст')
expect('В хранилище лежит версия схемы', Boolean(stored && stored.includes('"version"')), 'нет версии схемы')

const restored = createPinia()
const bootstrap = await bootstrapData(restored)
expect('Загрузка из хранилища (не демо)', bootstrap.source === 'storage', `источник: ${bootstrap.source}`)
expect(
  'Созданный шаблон сохранился',
  useTemplatesStore(restored).getById(created.id)?.name === 'Проверочный шаблон',
  'шаблон не восстановлен',
)
expect('Постоянное хранилище доступно', bootstrap.persistent === true, 'хранилище недоступно')

console.log(`\nПройдено: ${passed}, провалено: ${failed}`)
if (failed > 0) process.exitCode = 1
