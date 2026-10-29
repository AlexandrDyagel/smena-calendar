/**
 * Проверка взаимодействия в реальном DOM (jsdom).
 *
 * Закрывает то, что не видят серверные проверки: клики, реактивность после клика,
 * переключение между сотрудниками, назначение шаблона через модальное окно.
 *
 * Запуск: npm run check:dom
 * DOM-заглушки ставятся ДО динамического импорта Vue и компонентов.
 */
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
})

const { window } = dom
const globals = globalThis as unknown as Record<string, unknown>

globals.window = window
globals.document = window.document
globals.HTMLElement = window.HTMLElement
globals.SVGElement = window.SVGElement
globals.Element = window.Element
globals.Node = window.Node
globals.Event = window.Event
globals.MouseEvent = window.MouseEvent
globals.KeyboardEvent = window.KeyboardEvent
globals.getComputedStyle = window.getComputedStyle.bind(window)
globals.requestAnimationFrame = window.requestAnimationFrame.bind(window)
globals.cancelAnimationFrame = window.cancelAnimationFrame.bind(window)
// vue-router в браузерной сборке обращается к глобальным history/location.
globals.history = window.history
globals.location = window.location
globals.localStorage = window.localStorage

if (typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  })
}

/* ----------------------------- импорт приложения ---------------------------- */

const { createApp, nextTick } = await import('vue')
const { createPinia } = await import('pinia')
const EmployeeList = (await import('../src/components/employees/EmployeeList.vue')).default
const { applyAppData } = await import('../src/services/persistence')
const { createDemoData } = await import('../src/services/demo-data')
const { useScheduleStore } = await import('../src/stores/schedule')
const { handleBackPress, backHandlerCount } = await import('../src/services/back-button')
const { fullName, sortEmployees } = await import('../src/utils/employee')
const { addDays, endOfMonth, enumerateDates, formatRangeTitle, monthNameRu, startOfMonth, todayISO } =
  await import('../src/utils/date')
const { resolveEmployeeDay } = await import('../src/utils/schedule')
const { getShiftMeta } = await import('../src/constants/shift-types')

let passed = 0
let failed = 0

/** Собственные сообщения проверки пишем в исходный console.error, чтобы не ловить их как ошибки приложения. */
const reportError = console.error.bind(console)

function succeed(title: string): void {
  passed += 1
  console.log(`  ok   ${title}`)
}

function fail(title: string, reason: string, dump?: string): void {
  failed += 1
  reportError(`  FAIL ${title}`)
  reportError(`       ${reason}`)
  if (dump) {
    reportError('       --- панель ---')
    reportError(`       ${dump.replace(/\s+/g, ' ').slice(0, 600)}`)
    reportError('       -------------')
  }
}

function expect(title: string, condition: boolean, reason: string, dump?: string): void {
  if (condition) succeed(title)
  else fail(title, reason, dump)
}

/* ------------------------------- монтирование ------------------------------- */

const data = createDemoData()
/** Порядок карточек в интерфейсе — по алфавиту, как в EmployeeList. */
const sorted = sortEmployees(data.employees)

const pinia = createPinia()
applyAppData(data, pinia)

const host = window.document.getElementById('app') as HTMLElement
const collectedErrors: string[] = []
const originalError = console.error
console.error = (...args: unknown[]) => {
  collectedErrors.push(args.map(String).join(' '))
  originalError(...args)
}

const app = createApp(EmployeeList)
app.use(pinia)
app.mount(host)
await nextTick()

const cards = (): Element[] => Array.from(host.querySelectorAll('[data-testid="employee-card"]'))
const detail = (): HTMLElement | null => host.querySelector('[data-testid="employee-detail"]')
const detailText = (): string => detail()?.textContent?.replace(/\s+/g, ' ').trim() ?? ''
const bodyText = (): string => window.document.body.textContent?.replace(/\s+/g, ' ').trim() ?? ''

function click(element: Element | null | undefined): void {
  if (!element) throw new Error('Элемент для клика не найден')
  element.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
}

/** Ждёт обновления DOM, включая закрытие модальных окон с анимацией. */
async function settle(ms = 80): Promise<void> {
  await nextTick()
  await new Promise((resolve) => setTimeout(resolve, ms))
  await nextTick()
}

/** Находит кнопку по тексту, подсказке или aria-метке. */
function findButton(text: string, root: ParentNode = host): HTMLElement | null {
  const buttons = Array.from(root.querySelectorAll('button'))
  return (
    (buttons.find((button) => {
      const haystack = [
        button.textContent ?? '',
        button.getAttribute('title') ?? '',
        button.getAttribute('aria-label') ?? '',
      ].join(' ')
      return haystack.includes(text)
    }) as HTMLElement) ?? null
  )
}

/** Индекс карточки сотрудника с указанной фамилией. */
function cardIndexOf(lastName: string): number {
  return sorted.findIndex((employee) => employee.lastName === lastName)
}

console.log('\nРаздел «Работники»: выбор сотрудника (реальный DOM)')

expect(
  'Карточки сотрудников отрисованы',
  cards().length === sorted.length,
  `карточек: ${cards().length}, сотрудников: ${sorted.length}`,
)

expect(
  'До выбора в панели — подсказка',
  detailText().includes('Выберите сотрудника'),
  'нет подсказки о выборе сотрудника',
  detailText(),
)

/* --- Выбор сотрудника с графиком 2/2 (Иванов) --- */
const ivanovIndex = cardIndexOf('Иванов')
const ivanov = sorted[ivanovIndex]!
click(cards()[ivanovIndex])
await nextTick()
await nextTick()

const ivanovText = detailText()

expect(
  'После клика в панели появилось имя выбранного сотрудника',
  ivanovText.includes(fullName(ivanov)),
  `в панели нет «${fullName(ivanov)}»`,
  ivanovText,
)

expect(
  'Загрузился индивидуальный календарь со сводкой',
  ivanovText.includes('Рабочих смен') && ivanovText.includes('Часов'),
  'нет сводки по сменам и часам',
  ivanovText,
)

expect(
  'Загрузилась история назначений',
  ivanovText.includes('История назначений') && ivanovText.includes('2 через 2'),
  'нет истории назначений с шаблоном',
  ivanovText,
)

expect(
  'Загружен блок ручных изменений с причиной',
  ivanovText.includes('Ручные изменения') && ivanovText.includes('Отгул за переработку'),
  'нет ручных изменений сотрудника',
  ivanovText,
)

const gridCells = detail()?.querySelectorAll('.grid.grid-cols-7 > div').length ?? 0
expect(
  'В календаре отрисована сетка месяца (42 дня)',
  gridCells >= 42,
  `ячеек в сетке: ${gridCells}`,
  ivanovText,
)

const shiftChips = detail()?.querySelectorAll('.font-bold').length ?? 0
expect('В календаре видны смены', shiftChips > 0, 'в сетке нет смен', ivanovText)

/** Иванов работает по графику «2 через 2»: дневные смены есть, суточных нет. */
expect(
  'Сводка соответствует графику 2/2 (дневные есть, суточных нет)',
  /Дневных1[0-9]/.test(ivanovText) && /Суточных0/.test(ivanovText),
  'сводка не соответствует шаблону 2/2',
  ivanovText,
)

/* --- Переключение на сотрудника с другим графиком (Сидоров, «сутки через трое») --- */
const sidorovIndex = cardIndexOf('Сидоров')
const sidorov = sorted[sidorovIndex]!
click(cards()[sidorovIndex])
await nextTick()
await nextTick()

const sidorovText = detailText()

expect(
  'Переключение: панель показывает выбранного сотрудника',
  sidorovText.includes(fullName(sidorov)) && !sidorovText.includes(fullName(ivanov)),
  `панель не переключилась на «${fullName(sidorov)}»`,
  sidorovText,
)

/**
 * Ключевая проверка: календарь и история обязаны пересчитаться под нового сотрудника.
 * У Сидорова шаблон «сутки через трое» — суточные смены есть, дневных нет.
 */
expect(
  'Переключение: календарь и сводка пересчитаны под нового сотрудника',
  /Суточных[1-9]/.test(sidorovText) && /Дневных0/.test(sidorovText),
  'сводка осталась от прежнего сотрудника',
  sidorovText,
)

expect(
  'Переключение: история назначений обновилась',
  sidorovText.includes('Сутки через трое') && !sidorovText.includes('2 через 2'),
  'история назначений осталась от прежнего сотрудника',
  sidorovText,
)

expect(
  'Переключение: ручные изменения обновились',
  sidorovText.includes('Больничный лист'),
  'нет ручного изменения выбранного сотрудника',
  sidorovText,
)

/* --- Возврат к первому сотруднику --- */
click(cards()[ivanovIndex])
await nextTick()
await nextTick()
expect(
  'Возврат к прежнему сотруднику показывает его данные',
  detailText().includes(fullName(ivanov)) && /Дневных1[0-9]/.test(detailText()),
  'панель не вернулась к данным первого сотрудника',
  detailText(),
)

/* --- Назначение шаблона с будущей даты через модальное окно --- */
console.log('\nНазначение шаблона с будущей даты (через интерфейс)')

const futureDate = addDays(todayISO(), 40)
const [futureYear, futureMonth] = futureDate.split('-')

// Подготовка условия: у сотрудника не должно быть действующего графика,
// иначе при назначении с будущей даты предыдущий шаблон продолжит действовать.
const scheduleStore = useScheduleStore(pinia)
for (const assignment of scheduleStore.assignmentsForEmployee(ivanov.id)) {
  scheduleStore.removeAssignment(assignment.id)
}
await settle()

expect(
  'После снятия графика панель сообщает об отсутствии шаблона',
  detailText().includes('Шаблон графика не назначен'),
  'нет подсказки о назначении шаблона',
  detailText(),
)

click(findButton('Назначить шаблон', detail() ?? host))
await settle()

const modal = window.document.body.querySelector('[role="dialog"]')
expect('Модальное окно назначения открылось', Boolean(modal), 'окно не найдено', bodyText())

if (modal) {
  const select = modal.querySelector('select') as HTMLSelectElement | null
  const dateInput = modal.querySelector('input[type="date"]') as HTMLInputElement | null
  expect('В окне есть выбор шаблона и даты', Boolean(select && dateInput), 'нет полей формы')

  if (select && dateInput) {
    const chosen = data.templates.find((template) => template.name === 'День через день')!
    select.value = chosen.id
    select.dispatchEvent(new window.Event('change', { bubbles: true }))
    await nextTick()

    dateInput.value = futureDate
    dateInput.dispatchEvent(new window.Event('input', { bubbles: true }))
    await nextTick()

    click(findButton('Назначить', modal))
    await settle()
  }
}

expect(
  'Модальное окно закрылось после сохранения',
  !window.document.body.querySelector('[role="dialog"]'),
  'окно осталось открытым',
  bodyText(),
)

const afterAssignText = detailText()
expect(
  'Панель сообщила о будущем назначении с датой начала',
  afterAssignText.includes('начнётся') && afterAssignText.includes('День через день'),
  'панель не сообщает о будущем назначении',
  afterAssignText,
)

expect(
  'Панель НЕ пишет «Шаблон не назначен»',
  !afterAssignText.includes('Шаблон не назначен'),
  'панель сообщает, что шаблон не назначен',
  afterAssignText,
)

expect(
  'История назначений содержит новое назначение с датой начала',
  afterAssignText.includes('День через день'),
  'новое назначение не попало в историю',
  afterAssignText,
)

expect(
  'Календарь переключился на месяц начала графика',
  afterAssignText.includes(`${monthNameRu(Number(futureMonth))} ${futureYear}`),
  `календарь не показывает месяц ${monthNameRu(Number(futureMonth))} ${futureYear}`,
  afterAssignText,
)

const futureChips = detail()?.querySelectorAll('.font-bold').length ?? 0
expect(
  'В календаре видны смены месяца начала',
  futureChips > 0,
  'в календаре нет смен в месяце начала',
  afterAssignText,
)

/** Кнопка возврата к текущему месяцу работает. */
click(findButton('Текущий месяц', detail() ?? host))
await settle()
expect(
  'Возврат к текущему месяцу из месяца начала',
  detailText().includes(`${monthNameRu(Number(todayISO().slice(5, 7)))} ${todayISO().slice(0, 4)}`),
  'календарь не вернулся к текущему месяцу',
  detailText(),
)

/** Системная кнопка «Назад» закрывает модальное окно, а не приложение. */
click(findButton('Назначить шаблон', detail() ?? host))
await settle()
expect(
  'Модальное окно зарегистрировало обработчик «Назад»',
  backHandlerCount() === 1,
  `обработчиков: ${backHandlerCount()}`,
)

let modalNavigations = 0
const modalBackResult = await handleBackPress({
  canGoBack: () => true,
  goBack: () => {
    modalNavigations += 1
  },
})
await settle()
expect(
  '«Назад» закрывает модальное окно',
  modalBackResult === 'overlay' && !window.document.body.querySelector('[role="dialog"]'),
  `результат: ${modalBackResult}, окно осталось`,
)
expect(
  '«Назад» не уводит с маршрута при открытом окне',
  modalNavigations === 0,
  `переходов: ${modalNavigations}`,
)

/* --- Панель «Детали дня» и фильтр «Только рабочие смены» --- */
console.log('\nПанель «Детали дня»: фильтр «Только рабочие смены»')

// Закрываем предыдущее приложение и монтируем страницу календаря.
app.unmount()
host.innerHTML = ''

const calendarData = createDemoData()
const calendarPinia = createPinia()
applyAppData(calendarData, calendarPinia)

const CalendarView = (await import('../src/views/CalendarView.vue')).default
const { createRouter, createMemoryHistory } = await import('vue-router')

const calendarRouter = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/:all(.*)', component: { render: () => null } }],
})
const calendarApp = createApp(CalendarView)
calendarApp.use(calendarPinia)
calendarApp.use(calendarRouter)
await calendarRouter.push('/calendar')
await calendarRouter.isReady()
calendarApp.mount(host)
await nextTick()

const dayCells = host.querySelectorAll('[data-date]').length
expect('Сетка месяца отрисована (42 дня)', dayCells === 42, `дней в сетке: ${dayCells}`)

const activeEmployees = calendarData.employees.filter((employee) => employee.active)
const monthDates = enumerateDates(startOfMonth(todayISO()), endOfMonth(todayISO()))

/** Ищем день, где есть и рабочие смены, и выходные — тогда фильтр заметен. */
const targetDate = monthDates.find((date) => {
  const cells = activeEmployees.map((employee) =>
    resolveEmployeeDay(
      employee.id,
      date,
      calendarData.assignments,
      calendarData.templates,
      calendarData.overrides,
    ),
  )
  const working = cells.filter((cell) => cell.type && getShiftMeta(cell.type).isWork)
  const nonWorking = cells.filter((cell) => !cell.type || !getShiftMeta(cell.type).isWork)
  return working.length > 0 && nonWorking.length > 0
})

expect('Найден день с рабочими сменами и выходными', Boolean(targetDate), 'нет подходящего дня')

if (targetDate) {
  const cellsForDay = activeEmployees.map((employee) => ({
    employee,
    cell: resolveEmployeeDay(
      employee.id,
      targetDate,
      calendarData.assignments,
      calendarData.templates,
      calendarData.overrides,
    ),
  }))
  const workingNames = cellsForDay
    .filter((item) => item.cell.type && getShiftMeta(item.cell.type).isWork)
    .map((item) => fullName(item.employee))
  const nonWorkingNames = cellsForDay
    .filter((item) => !item.cell.type || !getShiftMeta(item.cell.type).isWork)
    .map((item) => fullName(item.employee))

  const dayCell = host.querySelector(`[data-date="${targetDate}"]`)
  click(dayCell)
  await settle()

  // Панель дня отрисовывается через Teleport, поэтому ищем её в документе.
  const drawer = (): HTMLElement | null =>
    window.document.body.querySelector('[data-testid="day-details"]')
  const drawerText = (): string => drawer()?.textContent?.replace(/\s+/g, ' ').trim() ?? ''

  expect('Панель дня открылась по клику на день', Boolean(drawer()), 'панель не найдена')

  expect(
    'Без фильтра в деталях дня видны все сотрудники',
    workingNames.every((name) => drawerText().includes(name)) &&
      nonWorkingNames.every((name) => drawerText().includes(name)),
    'не все сотрудники показаны без фильтра',
    drawerText(),
  )

  /** Включаем «Только рабочие смены» так же, как пользователь — галочкой в фильтрах. */
  const workDaysCheckbox = Array.from(host.querySelectorAll('label'))
    .find((label) => (label.textContent ?? '').includes('Только рабочие смены'))
    ?.querySelector('input[type="checkbox"]') as HTMLInputElement | undefined

  expect('В фильтрах есть галочка «Только рабочие смены»', Boolean(workDaysCheckbox), 'галочка не найдена')

  workDaysCheckbox?.click()
  await settle()

  expect(
    'После включения фильтра рабочие смены остались в деталях дня',
    workingNames.every((name) => drawerText().includes(name)),
    'рабочие смены пропали из деталей дня',
    drawerText(),
  )

  expect(
    'После включения фильтра выходные скрыты в деталях дня',
    nonWorkingNames.every((name) => !drawerText().includes(name)),
    'в деталях дня остались сотрудники с выходным',
    drawerText(),
  )

  expect(
    'Панель поясняет, сколько сотрудников скрыто',
    drawerText().includes('Скрыто фильтром «Только рабочие смены»') &&
      drawerText().includes(String(nonWorkingNames.length)),
    'нет пояснения о скрытых сотрудниках',
    drawerText(),
  )

  expect(
    'В деталях дня показаны смены сотрудника',
    drawerText().includes('По шаблону') && /\d+ ч/.test(drawerText()),
    'смены не показаны',
    drawerText(),
  )

  /** Кнопка «Показать всех» возвращает скрытых сотрудников. */
  click(findButton('Показать всех', drawer() ?? host))
  await settle()

  expect(
    'Кнопка «Показать всех» возвращает скрытых сотрудников',
    nonWorkingNames.every((name) => drawerText().includes(name)),
    'скрытые сотрудники не вернулись',
    drawerText(),
  )

  expect(
    'Кнопка «Показать всех» снимает галочку фильтра',
    workDaysCheckbox?.checked === false,
    'галочка фильтра осталась включённой',
  )
}

/** Закрываем панель крестиком: дальше проверяем «Назад» с чистого состояния. */
const openDrawer = window.document.body.querySelector('[data-testid="day-details"]')
click(findButton('Закрыть панель', openDrawer ?? host))
await settle()
expect(
  'Панель дня закрывается крестиком',
  !window.document.body.querySelector('[data-testid="day-details"]'),
  'панель осталась открытой',
)

/* --- Системная кнопка «Назад» --- */
console.log('\nСистемная кнопка «Назад» (Android)')

expect(
  'До открытия панелей обработчиков «Назад» нет',
  backHandlerCount() === 0,
  `обработчиков: ${backHandlerCount()}`,
)

click(host.querySelector('[data-date]'))
await settle()
expect(
  'Открытая панель дня зарегистрировала обработчик «Назад»',
  backHandlerCount() === 1,
  `обработчиков: ${backHandlerCount()}`,
)

let navigations = 0
const goBack = (): void => {
  navigations += 1
}

const overlayResult = await handleBackPress({ canGoBack: () => true, goBack })
await settle()
expect(
  '«Назад» закрывает панель дня',
  overlayResult === 'overlay' && !window.document.body.querySelector('[data-testid="day-details"]'),
  `результат: ${overlayResult}, панель осталась`,
)
expect(
  '«Назад» не уводит с маршрута, пока открыта панель',
  navigations === 0,
  `переходов: ${navigations}`,
)
expect(
  'После закрытия панели обработчик снят',
  backHandlerCount() === 0,
  `обработчиков: ${backHandlerCount()}`,
)

const historyResult = await handleBackPress({ canGoBack: () => true, goBack })
expect(
  'Без открытых панелей «Назад» возвращает по истории',
  historyResult === 'history' && navigations === 1,
  `результат: ${historyResult}, переходов: ${navigations}`,
)

const exitResult = await handleBackPress({ canGoBack: () => false, goBack })
expect(
  'Без истории «Назад» завершает приложение',
  exitResult === 'exit',
  `результат: ${exitResult}`,
)

/* --- Отчёты: переключение периода --- */
console.log('\nОтчёты: переключение «Год → Месяц → Квартал»')

calendarApp.unmount()
host.innerHTML = ''

const reportsData = createDemoData()
const reportsPinia = createPinia()
applyAppData(reportsData, reportsPinia)

const ReportsView = (await import('../src/views/ReportsView.vue')).default
const { useReportsStore } = await import('../src/stores/reports')
const reportsRouter = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/:all(.*)', component: { render: () => null } }],
})
const reportsApp = createApp(ReportsView)
reportsApp.use(reportsPinia)
reportsApp.use(reportsRouter)
await reportsRouter.push('/reports')
await reportsRouter.isReady()
reportsApp.mount(host)
await nextTick()

const reportsStore = useReportsStore(reportsPinia)

/** Значение итоговой ячейки таблицы отчёта: 5 — «Часов всего». */
function totalsHours(): number {
  const cells = host.querySelectorAll('[data-testid="reports-summary"] tfoot td')
  const text = (cells[5]?.textContent ?? '').replace(/\s/g, '')
  return text ? Number(text) : Number.NaN
}

expect(
  'Таблица отчёта отрисована',
  host.querySelectorAll('[data-testid="reports-summary"] tbody tr').length > 0,
  'нет строк отчёта',
)

expect(
  'Итоги содержат данные сразу после открытия',
  totalsHours() > 0,
  `часов в итогах: ${totalsHours()}`,
)

click(findButton('Год', host))
await settle()
expect(
  'После выбора «Год» итоги не обнулились',
  totalsHours() > 0 && reportsStore.preset === 'year',
  `preset: ${reportsStore.preset}, часов: ${totalsHours()}`,
)

click(findButton('Месяц', host))
await settle()
expect(
  'После «Год → Месяц» период вернулся к текущему месяцу',
  reportsStore.period.from === startOfMonth(todayISO()) &&
    reportsStore.period.to === endOfMonth(todayISO()),
  `период: ${reportsStore.period.from} — ${reportsStore.period.to}`,
)
expect(
  'После «Год → Месяц» данные заполнены, а не нули',
  totalsHours() > 0 && totalsHours() === reportsStore.report.totals.hoursTotal,
  `часов в таблице: ${totalsHours()}, в сторе: ${reportsStore.report.totals.hoursTotal}`,
)
expect(
  'Заголовок периода показывает текущий месяц',
  bodyText().includes(formatRangeTitle(reportsStore.period.from, reportsStore.period.to)),
  `нет заголовка ${formatRangeTitle(reportsStore.period.from, reportsStore.period.to)}`,
)

click(findButton('Квартал', host))
await settle()
expect(
  'После «Квартал» данные заполнены, а не нули',
  totalsHours() > 0 &&
    reportsStore.period.from <= startOfMonth(todayISO()) &&
    reportsStore.period.to >= endOfMonth(todayISO()),
  `период: ${reportsStore.period.from} — ${reportsStore.period.to}, часов: ${totalsHours()}`,
)

click(findButton('Год', host))
await settle()
click(findButton('Квартал', host))
await settle()
expect(
  'Повторное «Год → Квартал» тоже даёт данные',
  totalsHours() > 0,
  `часов: ${totalsHours()}`,
)

/** Стрелки сдвигают период относительно точки отсчёта. */
click(findButton('Предыдущий период', host))
await settle()
expect(
  'Стрелка «назад» показывает предыдущий период',
  reportsStore.period.from < startOfMonth(todayISO()),
  `период: ${reportsStore.period.from}`,
)

/* --- Содержимое скачиваемых CSV --- */
const pendingFiles: Array<Promise<ArrayBuffer>> = []
const originalCreateObjectURL = URL.createObjectURL
const originalRevokeObjectURL = URL.revokeObjectURL
const originalAnchorClick = window.HTMLAnchorElement.prototype.click

URL.createObjectURL = ((blob: Blob) => {
  // Читаем сырые байты: Blob.text() по спецификации отбрасывает BOM.
  pendingFiles.push(blob.arrayBuffer())
  return 'blob:smena-calendar-check'
}) as typeof URL.createObjectURL
URL.revokeObjectURL = (() => undefined) as typeof URL.revokeObjectURL
window.HTMLAnchorElement.prototype.click = function click() {
  /* скачивание в проверке не выполняем, содержимое уже перехвачено */
}

click(findButton('Отчёт в CSV', host))
await settle()
click(findButton('Детализация в CSV', host))
await settle()

const exportedFiles = await Promise.all(pendingFiles)
const reportBytes = new Uint8Array(exportedFiles[0] ?? new ArrayBuffer(0))
const detailBytes = new Uint8Array(exportedFiles[1] ?? new ArrayBuffer(0))

/** Первые три байта = EF BB BF: маркер UTF-8, по которому Excel понимает кодировку. */
function hasUtf8Bom(bytes: Uint8Array): boolean {
  return bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf
}

/** Сколько раз в файле встречается BOM (в середине его быть не должно). */
function countBom(bytes: Uint8Array): number {
  let count = 0
  for (let index = 0; index + 2 < bytes.length; index += 1) {
    if (bytes[index] === 0xef && bytes[index + 1] === 0xbb && bytes[index + 2] === 0xbf) {
      count += 1
    }
  }
  return count
}

const decoder = new TextDecoder('utf-8')
const reportText = decoder.decode(reportBytes)

expect('Кнопки экспорта создали два файла', exportedFiles.length === 2, `файлов: ${exportedFiles.length}`)

expect(
  'CSV отчёта начинается с маркера UTF-8 (BOM)',
  hasUtf8Bom(reportBytes),
  `первые байты: ${Array.from(reportBytes.slice(0, 6)).join(' ')}`,
)
expect(
  'BOM в CSV отчёта ровно один и только в начале',
  countBom(reportBytes) === 1,
  `вхождений BOM: ${countBom(reportBytes)}`,
)
expect(
  'CSV отчёта содержит читаемую кириллицу',
  reportText.includes('Период;') && reportText.includes('Сотрудник;Отдел;Должность'),
  `фрагмент: ${JSON.stringify(reportText.slice(0, 80))}`,
)
expect(
  'CSV детализации начинается с маркера UTF-8 (BOM)',
  hasUtf8Bom(detailBytes) && decoder.decode(detailBytes).includes('Сотрудник;Тип смены'),
  `первые байты: ${Array.from(detailBytes.slice(0, 6)).join(' ')}`,
)

URL.createObjectURL = originalCreateObjectURL
URL.revokeObjectURL = originalRevokeObjectURL
window.HTMLAnchorElement.prototype.click = originalAnchorClick

/* --- Хранилище: нативный репозиторий и выбор по платформе --- */
console.log('\nХранилище: нативный репозиторий (SharedPreferences)')

const { PreferencesRepository, LocalStorageRepository } = await import(
  '../src/services/local-repository'
)
const { getPlatform, getRepository, isPersistentStorage } = await import(
  '../src/services/repository'
)

const nativeRepository = new PreferencesRepository()
expect(
  'Нативный репозиторий доступен',
  nativeRepository.isAvailable() === true,
  'репозиторий недоступен',
)
expect(
  'Хранилище подписано понятным именем',
  nativeRepository.title.includes('SharedPreferences'),
  nativeRepository.title,
)

const nativeData = createDemoData()
const saveResult = await nativeRepository.save(nativeData)
expect('Запись в нативное хранилище прошла без ошибок', saveResult.ok, saveResult.error ?? 'ошибка')

const loadedNative = await nativeRepository.load()
expect('Данные прочитаны из нативного хранилища', loadedNative !== null, 'снимок не найден')
expect(
  'Состав работников сохранился полностью',
  loadedNative?.data.employees.map((employee) => employee.lastName).join(',') ===
    nativeData.employees.map((employee) => employee.lastName).join(','),
  `получено: ${loadedNative?.data.employees.map((employee) => employee.lastName).join(',')}`,
)
expect(
  'Шаблоны, назначения и переопределения сохранились',
  loadedNative?.data.templates.length === nativeData.templates.length &&
    loadedNative?.data.assignments.length === nativeData.assignments.length &&
    loadedNative?.data.overrides.length === nativeData.overrides.length,
  `шаблонов: ${loadedNative?.data.templates.length}, назначений: ${loadedNative?.data.assignments.length}, переопределений: ${loadedNative?.data.overrides.length}`,
)

await nativeRepository.clear()
expect(
  'Очистка нативного хранилища удаляет данные',
  (await nativeRepository.load()) === null,
  'данные остались в хранилище',
)

expect('В Node платформа определяется как web', getPlatform() === 'web', getPlatform())
expect(
  'В браузере выбран репозиторий localStorage',
  getRepository().kind === 'local' && isPersistentStorage(),
  `репозиторий: ${getRepository().kind}`,
)
expect(
  'Репозиторий localStorage тоже сохраняет и читает данные',
  await (async () => {
    const repository = new LocalStorageRepository()
    const probe = createDemoData()
    const saved = await repository.save(probe)
    const read = await repository.load()
    await repository.clear()
    return saved.ok && read?.data.templates.length === probe.templates.length
  })(),
  'цикл сохранения-чтения в localStorage нарушен',
)

/* --- Заставка приложения --- */
console.log('\nЗаставка: «дышащий» логотип и плавное скрытие')

const { hideWebSplash } = await import('../src/services/splash')

window.document.body.insertAdjacentHTML(
  'beforeend',
  '<div id="app-splash" role="status"><p class="app-splash__title">Календарь смен</p></div>',
)

const splashElement = (): HTMLElement | null => window.document.getElementById('app-splash')
expect('Заставка отрисована до запуска приложения', Boolean(splashElement()), 'нет элемента заставки')

hideWebSplash({ delayMs: 0, fadeMs: 20 })
await settle(120)

expect(
  'Заставка исчезла и удалена из документа',
  splashElement() === null,
  'элемент заставки остался в документе',
)

// Повторный вызов не должен падать, если заставки уже нет
let splashError: unknown = null
try {
  hideWebSplash({ delayMs: 0, fadeMs: 0 })
  await settle(60)
} catch (error) {
  splashError = error
}
expect(
  'Повторное скрытие заставки безопасно',
  splashError === null,
  `ошибка: ${String(splashError)}`,
)

if (collectedErrors.length > 0) {
  failed += 1
  reportError(`  FAIL во время работы интерфейса были ошибки (${collectedErrors.length}):`)
  collectedErrors.forEach((message) =>
    reportError(`       ${message.replace(/\s+/g, ' ').slice(0, 300)}`),
  )
} else {
  succeed('Во время работы интерфейса ошибок не возникло')
}

console.log(`\nПройдено: ${passed}, провалено: ${failed}`)
if (failed > 0) process.exitCode = 1
