import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { Employee, ISODate } from '@/types'
import { createId, nowISO } from '@/utils/id'
import { cloneList } from '@/utils/clone'
import { collectDepartments, fullName, sortEmployees } from '@/utils/employee'
import { normalizeHex, paletteColor } from '@/utils/color'
import { useScheduleStore } from './schedule'

/** Черновик работника для форм создания/редактирования. */
export interface EmployeeDraft {
  firstName: string
  lastName: string
  middleName?: string
  position?: string
  department?: string
  color: string
  active: boolean
}

/** Стор работников. */
export const useEmployeesStore = defineStore('employees', () => {
  const items = ref<Employee[]>([])

  /** Все работники, отсортированные по алфавиту. */
  const sorted = computed(() => sortEmployees(items.value))

  /** Только активные работники. */
  const activeEmployees = computed(() => sorted.value.filter((employee) => employee.active))

  /** Быстрый доступ по идентификатору. */
  const byId = computed(() => new Map(items.value.map((employee) => [employee.id, employee] as const)))

  /** Список отделов. */
  const departments = computed(() => collectDepartments(items.value))

  /** Сколько работников в архиве. */
  const archivedCount = computed(() => items.value.filter((employee) => !employee.active).length)

  /** Загружает список из хранилища. */
  function hydrate(list: Employee[]): void {
    items.value = cloneList(list)
  }

  /** Снимок для сохранения. */
  function snapshot(): Employee[] {
    return cloneList(items.value)
  }

  function getById(id: string | null | undefined): Employee | undefined {
    if (!id) return undefined
    return byId.value.get(id)
  }

  /** ФИО работника либо заглушка. */
  function nameOf(id: string | null | undefined): string {
    const employee = getById(id)
    return employee ? fullName(employee) : 'Работник удалён'
  }

  /** Создаёт работника. */
  function create(draft: EmployeeDraft): Employee {
    const timestamp = nowISO()
    const employee: Employee = {
      id: createId('emp'),
      firstName: draft.firstName.trim(),
      lastName: draft.lastName.trim(),
      middleName: draft.middleName?.trim() || undefined,
      position: draft.position?.trim() || undefined,
      department: draft.department?.trim() || undefined,
      color: normalizeHex(draft.color, paletteColor(items.value.length)),
      active: draft.active,
      createdAt: timestamp,
      updatedAt: timestamp,
      archivedAt: draft.active ? null : timestamp,
    }
    items.value = [...items.value, employee]
    return employee
  }

  /** Обновляет работника. */
  function update(id: string, patch: Partial<EmployeeDraft>): Employee | null {
    const index = items.value.findIndex((employee) => employee.id === id)
    if (index === -1) return null
    const current = items.value[index]!
    const nextActive = patch.active ?? current.active
    const next: Employee = {
      ...current,
      firstName: patch.firstName?.trim() || current.firstName,
      lastName: patch.lastName?.trim() || current.lastName,
      middleName: patch.middleName !== undefined ? patch.middleName.trim() || undefined : current.middleName,
      position: patch.position !== undefined ? patch.position.trim() || undefined : current.position,
      department:
        patch.department !== undefined ? patch.department.trim() || undefined : current.department,
      color: patch.color !== undefined ? normalizeHex(patch.color, current.color) : current.color,
      active: nextActive,
      updatedAt: nowISO(),
      archivedAt: nextActive ? null : current.archivedAt ?? nowISO(),
    }
    const copy = [...items.value]
    copy[index] = next
    items.value = copy
    return next
  }

  /** Переводит работника в архив (история смен сохраняется). */
  function deactivate(id: string): Employee | null {
    return update(id, { active: false })
  }

  /** Возвращает работника из архива. */
  function activate(id: string): Employee | null {
    return update(id, { active: true })
  }

  /**
   * Полное удаление работника вместе со связанными данными.
   * Требует явного подтверждения в интерфейсе: история смен и переопределения будут потеряны.
   */
  function remove(id: string): boolean {
    const exists = items.value.some((employee) => employee.id === id)
    if (!exists) return false
    useScheduleStore().removeEmployeeData(id)
    items.value = items.value.filter((employee) => employee.id !== id)
    return true
  }

  /** Назначает шаблон работнику с определённой даты (делегируется в schedule-стор). */
  function assignTemplate(payload: {
    employeeId: string
    templateId: string
    startDate: ISODate
    endDate?: ISODate | null
    comment?: string
  }): boolean {
    if (!getById(payload.employeeId)) return false
    useScheduleStore().assignTemplate(payload)
    return true
  }

  return {
    items,
    sorted,
    activeEmployees,
    byId,
    departments,
    archivedCount,
    hydrate,
    snapshot,
    getById,
    nameOf,
    create,
    update,
    deactivate,
    activate,
    remove,
    assignTemplate,
  }
})
