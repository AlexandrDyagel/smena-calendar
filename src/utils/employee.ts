import type { Employee } from '@/types'

/** Фамилия Имя Отчество. */
export function fullName(employee: Pick<Employee, 'lastName' | 'firstName' | 'middleName'>): string {
  return [employee.lastName, employee.firstName, employee.middleName]
    .filter((part) => Boolean(part && part.trim()))
    .join(' ')
}

/** Фамилия И. О. — компактный вариант для плотных таблиц. */
export function shortName(employee: Pick<Employee, 'lastName' | 'firstName' | 'middleName'>): string {
  const initials = [employee.firstName, employee.middleName]
    .filter((part) => Boolean(part && part.trim()))
    .map((part) => `${part!.trim().charAt(0).toUpperCase()}.`)
    .join(' ')
  return [employee.lastName, initials].filter(Boolean).join(' ').trim()
}

/** Инициалы для аватара: «ИИ» или «И». */
export function initials(employee: Pick<Employee, 'lastName' | 'firstName'>): string {
  const first = employee.firstName?.trim().charAt(0) ?? ''
  const last = employee.lastName?.trim().charAt(0) ?? ''
  return `${last}${first}`.toUpperCase() || '—'
}

/** Сортировка работников по алфавиту (фамилия, затем имя). */
export function sortEmployees(employees: Employee[]): Employee[] {
  return [...employees].sort((a, b) => {
    const byLast = a.lastName.localeCompare(b.lastName, 'ru')
    if (byLast !== 0) return byLast
    return a.firstName.localeCompare(b.firstName, 'ru')
  })
}

/** Уникальный список отделов. */
export function collectDepartments(employees: Employee[]): string[] {
  const set = new Set<string>()
  for (const employee of employees) {
    const value = employee.department?.trim()
    if (value) set.add(value)
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'ru'))
}
