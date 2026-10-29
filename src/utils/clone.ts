/** Простое глубокое клонирование доменных объектов. */
export function deepClone<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value)
    } catch {
      /* некоторые среды не умеют клонировать прокси — используем JSON */
    }
  }
  return JSON.parse(JSON.stringify(value)) as T
}

/** Клонирование массива объектов. */
export function cloneList<T>(list: readonly T[]): T[] {
  return list.map((item) => deepClone(item))
}
