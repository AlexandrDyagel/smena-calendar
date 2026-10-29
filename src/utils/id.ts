/** Генерация идентификаторов и отметок времени. */

/** Быстрый fallback, если crypto.randomUUID недоступен (старые браузеры, http). */
function fallbackId(): string {
  const random = Math.random().toString(36).slice(2, 10)
  const time = Date.now().toString(36)
  return `${time}${random}`
}

/** Создаёт уникальный идентификатор с префиксом: `emp_1a2b3c4d`. */
export function createId(prefix = 'id'): string {
  const canUseCrypto = typeof globalThis.crypto !== 'undefined' && 'randomUUID' in globalThis.crypto
  const uuid = canUseCrypto
    ? globalThis.crypto.randomUUID().replace(/-/g, '')
    : fallbackId().replace(/[^a-z0-9]/gi, '')
  return `${prefix}_${uuid.slice(0, 12)}`
}

/** Текущая отметка времени в ISO 8601 (UTC). */
export function nowISO(): string {
  return new Date().toISOString()
}

/** Безопасное сравнение идентификаторов для стабильной сортировки. */
export function compareIds(a: string, b: string): number {
  return a.localeCompare(b)
}
