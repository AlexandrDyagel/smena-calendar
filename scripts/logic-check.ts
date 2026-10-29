/**
 * Самопроверка ключевой логики приложения (без браузера и без сборщика).
 * Запуск: npm run check:logic
 * Требуется Node 22.18+ (запуск TypeScript «из коробки»).
 */
import assert from 'node:assert/strict'
import {
  addDays,
  addMonths,
  endOfMonth,
  formatDateHuman,
  getMonthGrid,
  isHoliday,
  isoWeekNumber,
  startOfMonth,
  toDayIndex,
  todayISO,
} from '../src/utils/date.ts'
import {
  findAssignmentConflicts,
  resolveEmployeeDay,
  resolveRange,
  resolveTemplateDay,
} from '../src/utils/schedule.ts'
import { buildReport } from '../src/utils/reports.ts'
import { buildIcs, buildJsonBundle, buildReportCsv, buildScheduleCsv, toCsv } from '../src/utils/export.ts'
import { createDemoData } from '../src/services/demo-data.ts'
import { parseImportText } from '../src/services/validation.ts'
import { createPresetTemplates } from '../src/constants/presets.ts'
import { getShiftMeta } from '../src/constants/shift-types.ts'
import { matchesEmployeeFilters, matchesShiftFilters } from '../src/utils/filters.ts'
import type {
  CalendarCell,
  CalendarFilters,
  CalendarOverride,
  Employee,
  EmployeeTemplateAssignment,
  ISODate,
  ScheduleTemplate,
} from '../src/types/index.ts'

let passed = 0
function check(title: string, fn: () => void): void {
  try {
    fn()
    passed += 1
    console.log(`  ok   ${title}`)
  } catch (error) {
    console.error(`  FAIL ${title}`)
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}

const start: ISODate = '2026-01-01'

console.log('\n1. Пресеты шаблонов')
const presets = createPresetTemplates(start)
const byName = (name: string): ScheduleTemplate => {
  const template = presets.find((item) => item.name === name)
  assert.ok(template, `пресет «${name}» не найден`)
  return template
}

check('«2 через 2» = [Д, Д, В, В]', () => {
  const t = byName('2 через 2')
  assert.deepEqual(
    t.segments.map((s) => s.type),
    ['DAY', 'DAY', 'OFF', 'OFF'],
  )
})

check('«Сутки через трое» = [С, В, В, В] с 24 ч', () => {
  const t = byName('Сутки через трое')
  assert.deepEqual(
    t.segments.map((s) => s.type),
    ['FULL', 'OFF', 'OFF', 'OFF'],
  )
  assert.equal(t.segments[0]!.hours, 24)
})

check('«День через день» = [Д, В]', () => {
  const t = byName('День через день')
  assert.deepEqual(
    t.segments.map((s) => s.type),
    ['DAY', 'OFF'],
  )
})

check('«5/2» = 5 рабочих + 2 выходных', () => {
  const t = byName('5/2 (пятидневка)')
  assert.equal(t.segments.length, 7)
  assert.equal(t.segments.filter((s) => getShiftMeta(s.type).isWork).length, 5)
})

check('сложный цикл = 8 дней: С В С В В В В В', () => {
  const t = byName('Сложный смешанный цикл')
  assert.equal(t.segments.length, 8)
  assert.deepEqual(
    t.segments.map((s) => s.type),
    ['FULL', 'OFF', 'FULL', 'OFF', 'OFF', 'OFF', 'OFF', 'OFF'],
  )
  // Две суточные смены по 24 часа и шесть выходных
  assert.equal(t.segments.filter((s) => s.type === 'FULL').length, 2)
  assert.equal(t.segments.filter((s) => s.type === 'OFF').length, 6)
  assert.equal(t.segments[0]!.hours, 24)
})

/** Цепочка цикла должна повторяться каждые 8 дней. */
check('сложный цикл повторяется через 8 дней', () => {
  const t = byName('Сложный смешанный цикл')
  const sequence = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(
    (offset) => resolveTemplateDay(t, start, addDays(start, offset))!.segment.type,
  )
  assert.deepEqual(sequence, [
    'FULL',
    'OFF',
    'FULL',
    'OFF',
    'OFF',
    'OFF',
    'OFF',
    'OFF',
    'FULL',
    'OFF',
  ])
})

console.log('\n2. Расчёт цикла')
check('цикл повторяется: смещения 0..7 для 2/2', () => {
  const t = byName('2 через 2')
  const sequence = [0, 1, 2, 3, 4, 5, 6, 7].map(
    (offset) => resolveTemplateDay(t, start, addDays(start, offset))!.segment.type,
  )
  assert.deepEqual(sequence, ['DAY', 'DAY', 'OFF', 'OFF', 'DAY', 'DAY', 'OFF', 'OFF'])
})

check('отрицательное смещение (дата до начала) считается корректно', () => {
  const t = byName('2 через 2')
  const before = resolveTemplateDay(t, start, addDays(start, -1))!
  assert.equal(before.segment.type, 'OFF')
  assert.equal(before.index, 3)
  assert.equal(before.cycleIndex, -1)
})

check('номер прохода цикла растёт', () => {
  const t = byName('Сутки через трое')
  const day5 = resolveTemplateDay(t, start, addDays(start, 5))!
  assert.equal(day5.index, 1)
  assert.equal(day5.cycleIndex, 1)
})

check('шаблон без сегментов не ломает расчёт', () => {
  const empty: ScheduleTemplate = {
    id: 'empty',
    name: 'Пустой',
    segments: [],
    startDate: start,
    isPreset: false,
    createdAt: '',
    updatedAt: '',
  }
  assert.equal(resolveTemplateDay(empty, start, start), null)
})

console.log('\n3. Приоритеты: назначения и переопределения')
const employeeId = 'emp_1'
const templateA = byName('2 через 2')
const templateB = byName('День через день')

const assignmentEarly: EmployeeTemplateAssignment = {
  id: 'asg_1',
  employeeId,
  templateId: templateA.id,
  startDate: '2026-01-01',
  endDate: null,
  createdAt: '2026-01-01T00:00:00.000Z',
}
const assignmentLate: EmployeeTemplateAssignment = {
  id: 'asg_2',
  employeeId,
  templateId: templateB.id,
  startDate: '2026-01-03',
  endDate: null,
  createdAt: '2026-01-03T00:00:00.000Z',
}

check('при двух активных назначениях побеждает последнее начавшееся', () => {
  const cell = resolveEmployeeDay('emp_1', '2026-01-04', [assignmentEarly, assignmentLate], presets, [])
  assert.equal(cell.source, 'template')
  assert.equal(cell.templateId, templateB.id)
  assert.equal(cell.conflict, true)
  assert.deepEqual(cell.conflictAssignmentIds, ['asg_1'])
})

check('переопределение перекрывает шаблон', () => {
  const override: CalendarOverride = {
    id: 'ovr_1',
    employeeId,
    date: '2026-01-04',
    type: 'VACATION',
    reason: 'Отпуск',
    createdAt: '',
    updatedAt: '',
  }
  const cell = resolveEmployeeDay('emp_1', '2026-01-04', [assignmentEarly], presets, [override])
  assert.equal(cell.source, 'override')
  assert.equal(cell.type, 'VACATION')
  assert.equal(cell.hours, 0)
  assert.equal(cell.overrideId, 'ovr_1')
})

check('переопределение с явными часами учитывается', () => {
  const override: CalendarOverride = {
    id: 'ovr_2',
    employeeId,
    date: '2026-01-05',
    type: 'NIGHT',
    hours: 10,
    createdAt: '',
    updatedAt: '',
  }
  const cell = resolveEmployeeDay('emp_1', '2026-01-05', [assignmentEarly], presets, [override])
  assert.equal(cell.hours, 10)
  assert.equal(cell.type, 'NIGHT')
})

check('без назначения день не размечен', () => {
  const cell = resolveEmployeeDay('emp_9', '2026-01-04', [assignmentEarly], presets, [])
  assert.equal(cell.source, 'none')
  assert.equal(cell.type, null)
  assert.equal(cell.message, 'Шаблон не назначен')
})

check('дата вне периода назначения (endDate) не размечена', () => {
  const closed: EmployeeTemplateAssignment = { ...assignmentEarly, endDate: '2026-01-02' }
  assert.equal(resolveEmployeeDay(employeeId, '2026-01-03', [closed], presets, []).source, 'none')
  assert.equal(resolveEmployeeDay(employeeId, '2026-01-02', [closed], presets, []).source, 'template')
})

check('переопределение работает и до начала действия шаблона', () => {
  const override: CalendarOverride = {
    id: 'ovr_3',
    employeeId,
    date: '2025-12-15',
    type: 'SICK',
    createdAt: '',
    updatedAt: '',
  }
  const cell = resolveEmployeeDay(employeeId, '2025-12-15', [assignmentEarly], presets, [override])
  assert.equal(cell.type, 'SICK')
})

check('несуществующий шаблон назначения помечается', () => {
  const broken: EmployeeTemplateAssignment = { ...assignmentEarly, templateId: 'no-such' }
  const cell = resolveEmployeeDay(employeeId, '2026-01-05', [broken], presets, [])
  assert.equal(cell.source, 'missing-template')
})

check('конфликты назначений находятся', () => {
  const conflicts = findAssignmentConflicts([assignmentEarly, assignmentLate])
  assert.equal(conflicts.length, 1)
  assert.deepEqual(conflicts[0]!.assignmentIds, ['asg_1', 'asg_2'])
})

check('resolveRange возвращает дни для всех сотрудников', () => {
  const cells = resolveRange(
    ['emp_1', 'emp_2'],
    '2026-01-01',
    '2026-01-31',
    { assignments: [assignmentEarly], templates: presets, overrides: [] },
  )
  assert.equal(cells.length, 62)
})

console.log('\n4. Отчёт')
check('отчёт считает смены, выходные и часы', () => {
  const employees = [
    {
      id: employeeId,
      firstName: 'Иван',
      lastName: 'Иванов',
      color: '#2563eb',
      active: true,
      createdAt: '',
    },
  ]
  const period = { from: '2026-01-01', to: '2026-01-31' }
  const cells = resolveRange([employeeId], period.from, period.to, {
    assignments: [assignmentEarly],
    templates: presets,
    overrides: [],
  })
  const report = buildReport({ cells, employees, period })
  const row = report.rows[0]!
  // 2/2: 31 день → 16 рабочих, 15 выходных, 16 * 12 = 192 часа
  assert.equal(row.workShifts, 16)
  assert.equal(row.offDays, 15)
  assert.equal(row.dayShifts, 16)
  assert.equal(row.hoursTotal, 192)
  assert.equal(report.days, 31)
  assert.equal(report.totals.workShifts, 16)
  assert.equal(report.totals.hoursTotal, 192)
  assert.ok(report.byType.some((item) => item.type === 'DAY' && item.count === 16))
})

check('переопределения попадают в отчёт', () => {
  const employees = [
    { id: employeeId, firstName: 'Иван', lastName: 'Иванов', color: '#2563eb', active: true, createdAt: '' },
  ]
  const period = { from: '2026-01-01', to: '2026-01-31' }
  const override: CalendarOverride = {
    id: 'ovr_4',
    employeeId,
    date: '2026-01-01',
    type: 'VACATION',
    createdAt: '',
    updatedAt: '',
  }
  const cells = resolveRange([employeeId], period.from, period.to, {
    assignments: [assignmentEarly],
    templates: presets,
    overrides: [override],
  })
  const report = buildReport({ cells, employees, period })
  const row = report.rows[0]!
  assert.equal(row.vacationDays, 1)
  assert.equal(row.manualOverrides, 1)
  assert.equal(row.workShifts, 15)
  assert.equal(row.hoursTotal, 180)
})

check('пустой период не ломает отчёт', () => {
  const report = buildReport({ cells: [], employees: [], period: { from: '2026-01-01', to: '2026-01-31' } })
  assert.equal(report.rows.length, 0)
  assert.equal(report.totals.hoursTotal, 0)
})

console.log('\n5. Даты')
check('сетка месяца — 42 дня, начиная с понедельника', () => {
  const grid = getMonthGrid('2026-01-15', 1)
  assert.equal(grid.length, 42)
  assert.equal(grid[0], '2025-12-29')
})

check('границы месяца корректны для февраля и високосного года', () => {
  assert.equal(endOfMonth('2026-02-10'), '2026-02-28')
  assert.equal(endOfMonth('2024-02-10'), '2024-02-29')
  assert.equal(startOfMonth('2026-02-10'), '2026-02-01')
})

check('прибавление месяца не выходит за границы', () => {
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28')
  assert.equal(addMonths('2026-01-15', -1), '2025-12-15')
})

check('арифметика дат не зависит от часового пояса и переходов времени', () => {
  assert.equal(toDayIndex('2026-01-01') + 1, toDayIndex('2026-01-02'))
  assert.equal(addDays('2026-03-28', 2), '2026-03-30')
  assert.equal(formatDateHuman('2026-01-01'), '1 января 2026')
})

check('номер недели ISO и праздники', () => {
  assert.equal(isoWeekNumber('2026-01-01'), 1)
  assert.equal(isHoliday('2026-01-07'), true)
  assert.equal(isHoliday('2026-01-14'), false)
})

console.log('\n6. Демо-данные')
const demo = createDemoData()
check('демо-набор содержит 6 шаблонов, 6 работников, назначения и переопределения', () => {
  assert.equal(demo.templates.length, 6)
  assert.equal(demo.employees.length, 6)
  assert.ok(demo.assignments.length >= 6)
  assert.ok(demo.overrides.length >= 3)
})

check('текущий месяц заполнен расчётами у всех активных сотрудников', () => {
  const period = { from: startOfMonth(todayISO()), to: endOfMonth(todayISO()) }
  const activeIds = demo.employees.filter((employee) => employee.active).map((employee) => employee.id)
  const cells = resolveRange(activeIds, period.from, period.to, {
    assignments: demo.assignments,
    templates: demo.templates,
    overrides: demo.overrides,
  })
  for (const id of activeIds) {
    const own = cells.filter((cell) => cell.employeeId === id)
    assert.equal(own.length, Number(endOfMonth(todayISO()).slice(8, 10)), `дней у ${id}`)
    assert.ok(own.some((cell) => cell.type && getShiftMeta(cell.type).isWork), `нет рабочих смен у ${id}`)
  }
  assert.ok(cells.some((cell) => cell.source === 'override'), 'переопределения не попали в текущий месяц')
})

console.log('\n7. Экспорт')
check('CSV экранирует разделители и кавычки', () => {
  const csv = toCsv(
    [{ name: 'Иванов; "старший"', value: 12, note: 'перенос\nстроки' }],
    [
      { key: 'name', title: 'Сотрудник', value: (row) => row.name },
      { key: 'value', title: 'Часы', value: (row) => row.value },
      { key: 'note', title: 'Комментарий', value: (row) => row.note },
    ],
  )
  assert.ok(csv.startsWith('\uFEFF'))
  assert.ok(csv.includes('"Иванов; ""старший"""'))
  assert.ok(csv.includes('"перенос\nстроки"'))
})

check('CSV расписания содержит строки по дням', () => {
  const cells = resolveRange([employeeId], '2026-01-01', '2026-01-31', {
    assignments: [assignmentEarly],
    templates: presets,
    overrides: [],
  })
  const employeesById = new Map([
    [employeeId, { id: employeeId, firstName: 'Иван', lastName: 'Иванов', color: '#000', active: true, createdAt: '' }],
  ])
  const templatesById = new Map(presets.map((template) => [template.id, template]))
  const csv = buildScheduleCsv(cells, employeesById, templatesById)
  const lines = csv.trim().split('\r\n')
  assert.equal(lines.length, 32)
  assert.ok(lines[0]!.includes('Тип смены'))
  assert.ok(lines[1]!.includes('2026-01-01'))
  assert.ok(lines[1]!.includes('Дневная смена'))
  assert.ok(lines[3]!.includes('Выходной'))
})

check('iCal содержит корректные события', () => {
  const cells = resolveRange([employeeId], '2026-01-01', '2026-01-07', {
    assignments: [assignmentEarly],
    templates: presets,
    overrides: [],
  })
  const employeesById = new Map([
    [employeeId, { id: employeeId, firstName: 'Иван', lastName: 'Иванов', color: '#000', active: true, createdAt: '' }],
  ])
  const ics = buildIcs(cells, employeesById, { calendarName: 'Смены' })
  assert.ok(ics.startsWith('BEGIN:VCALENDAR'))
  assert.ok(ics.trimEnd().endsWith('END:VCALENDAR'))
  assert.equal((ics.match(/BEGIN:VEVENT/g) ?? []).length, 4)
  assert.ok(ics.includes('DTSTART;VALUE=DATE:20260101'))
  assert.ok(ics.includes('DTEND;VALUE=DATE:20260102'))
  assert.ok(ics.includes('SUMMARY:Иванов Иван — Дневная смена'))
})

check('CSV отчёта начинается с BOM — иначе Excel ломает кириллицу', () => {
  const employees = [
    {
      id: employeeId,
      firstName: 'Иван',
      lastName: 'Иванов',
      color: '#2563eb',
      active: true,
      createdAt: '',
    },
  ]
  const period = { from: '2026-01-01', to: '2026-01-31' }
  const cells = resolveRange([employeeId], period.from, period.to, {
    assignments: [assignmentEarly],
    templates: presets,
    overrides: [],
  })
  const report = buildReport({ cells, employees, period })
  const csv = buildReportCsv(report)

  assert.equal(csv.indexOf('\uFEFF'), 0, 'BOM должен быть первым символом файла')
  assert.equal((csv.match(/\uFEFF/g) ?? []).length, 1, 'BOM должен встречаться ровно один раз')
  assert.ok(csv.includes('Период;2026-01-01;2026-01-31;дней;31'), 'нет строки периода')
  assert.ok(csv.includes('Сотрудник;Отдел;Должность'), 'нет заголовков отчёта')
  assert.ok(csv.includes('Иванов Иван'), 'нет данных сотрудника')
})

check('CSV расписания и детализации тоже начинаются с BOM', () => {
  assert.equal(buildScheduleCsv([], new Map(), new Map()).indexOf('\uFEFF'), 0)
  assert.equal(toCsv([], [{ key: 'a', title: 'Сотрудник', value: () => '' }]).indexOf('\uFEFF'), 0)
})

console.log('\n8. Импорт/экспорт JSON')
check('выгрузка и обратный разбор сохраняют данные', () => {
  const json = buildJsonBundle(demo, { app: 'smena-calendar', appVersion: '1.0.0', schemaVersion: 1 })
  const result = parseImportText(json)
  assert.equal(result.stats.templates, demo.templates.length)
  assert.equal(result.stats.employees, demo.employees.length)
  assert.equal(result.stats.assignments, demo.assignments.length)
  assert.equal(result.stats.overrides, demo.overrides.length)
  assert.equal(result.warnings.length, 0)
})

check('битый JSON даёт понятную ошибку', () => {
  assert.throws(() => parseImportText('{ not json'), /корректным JSON/)
})

check('пустой набор данных отклоняется', () => {
  assert.throws(() => parseImportText('{"templates":[],"employees":[]}'), /нет ни одного/)
})

check('некорректные записи отбрасываются с предупреждениями', () => {
  const payload = JSON.stringify({
    version: 1,
    templates: [{ name: 'Тест', segments: [{ type: 'НЕИЗВЕСТНО' }] }],
    employees: [{ firstName: 'Иван' }, { firstName: 'Пётр', lastName: 'Петров' }],
    assignments: [{ employeeId: 'nope', templateId: 'nope', startDate: '2026-01-01' }],
    overrides: [{ employeeId: 'nope', date: '2026-13-45', type: 'DAY' }],
  })
  const result = parseImportText(payload)
  assert.equal(result.data.employees.length, 1)
  assert.equal(result.data.templates.length, 1)
  assert.equal(result.data.templates[0]!.segments.length, 0)
  assert.equal(result.data.assignments.length, 0)
  assert.equal(result.data.overrides.length, 0)
  assert.ok(result.warnings.length >= 4)
})

console.log('\n9. Фильтры календаря и деталей дня')

const baseFilters: CalendarFilters = {
  employeeIds: [],
  departments: [],
  shiftTypes: [],
  onlyWorkDays: false,
  showInactive: false,
}

const dayCell: CalendarCell = {
  employeeId: 'emp_1',
  date: '2026-01-01',
  source: 'template',
  type: 'DAY',
  hours: 12,
}

check('«Только рабочие смены» отсекает выходные, отпуск, больничный и пустые дни', () => {
  const filters: CalendarFilters = { ...baseFilters, onlyWorkDays: true }
  assert.equal(matchesShiftFilters(dayCell, filters), true)
  assert.equal(matchesShiftFilters({ ...dayCell, type: 'NIGHT' }, filters), true)
  assert.equal(matchesShiftFilters({ ...dayCell, type: 'FULL', hours: 24 }, filters), true)
  assert.equal(matchesShiftFilters({ ...dayCell, type: 'OFF', hours: 0 }, filters), false)
  assert.equal(matchesShiftFilters({ ...dayCell, type: 'VACATION', hours: 0 }, filters), false)
  assert.equal(matchesShiftFilters({ ...dayCell, type: 'SICK', hours: 0 }, filters), false)
  assert.equal(matchesShiftFilters({ ...dayCell, type: null, hours: 0 }, filters), false)
})

check('фильтр по типам смен оставляет только выбранные типы', () => {
  const filters: CalendarFilters = { ...baseFilters, shiftTypes: ['FULL', 'NIGHT'] }
  assert.equal(matchesShiftFilters({ ...dayCell, type: 'FULL' }, filters), true)
  assert.equal(matchesShiftFilters({ ...dayCell, type: 'NIGHT' }, filters), true)
  assert.equal(matchesShiftFilters(dayCell, filters), false)
  assert.equal(matchesShiftFilters({ ...dayCell, type: null }, filters), false)
})

check('фильтр по сотрудникам и отделам', () => {
  const employee: Employee = {
    id: 'emp_1',
    firstName: 'Иван',
    lastName: 'Иванов',
    department: 'Электрики',
    color: '#000',
    active: true,
    createdAt: '',
  }
  assert.equal(matchesEmployeeFilters(employee, baseFilters), true)
  assert.equal(
    matchesEmployeeFilters(employee, { ...baseFilters, employeeIds: ['emp_2'] }),
    false,
  )
  assert.equal(
    matchesEmployeeFilters(employee, { ...baseFilters, departments: ['Слесаря'] }),
    false,
  )
  assert.equal(
    matchesEmployeeFilters(employee, { ...baseFilters, departments: ['Электрики'] }),
    true,
  )
  assert.equal(
    matchesEmployeeFilters({ ...employee, active: false }, baseFilters),
    false,
    'архивный сотрудник не должен показываться без флага',
  )
  assert.equal(
    matchesEmployeeFilters(
      { ...employee, active: false },
      { ...baseFilters, showInactive: true },
    ),
    true,
  )
})

console.log(`\nПройдено проверок: ${passed}`)
if (process.exitCode) {
  console.error('\nЕсть ошибки — см. выше.\n')
} else {
  console.log('Все проверки пройдены.\n')
}
