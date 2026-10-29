import { Capacitor } from '@capacitor/core'
import {
  LocalStorageRepository,
  MemoryRepository,
  PreferencesRepository,
  type DataRepository,
} from './local-repository'

export type { DataRepository, SaveResult, StorageSnapshot } from './local-repository'

/**
 * Единственная точка выбора хранилища.
 *
 * — Android/iOS: нативное хранилище (SharedPreferences / UserDefaults),
 *   потому что localStorage внутри WebView система может очистить;
 * — браузер: localStorage, а если он запрещён — хранилище в памяти.
 *
 * Здесь же в будущем появится реализация ApiRepository без изменения сторов.
 */
let repository: DataRepository | null = null

/** Определяет платформу, на которой запущено приложение. */
export function getPlatform(): 'android' | 'ios' | 'web' {
  const platform = Capacitor.getPlatform()
  if (platform === 'android') return 'android'
  if (platform === 'ios') return 'ios'
  return 'web'
}

/** Приложение запущено как нативное (внутри APK/IPA). */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform()
}

function createRepository(): DataRepository {
  if (isNativeApp()) {
    return new PreferencesRepository()
  }

  const local = new LocalStorageRepository()
  return local.isAvailable() ? local : new MemoryRepository()
}

/** Текущий репозиторий данных (создаётся лениво). */
export function getRepository(): DataRepository {
  if (!repository) {
    repository = createRepository()
  }
  return repository
}

/** Подмена репозитория (используется в тестах и при переходе на другой бэкенд). */
export function setRepository(next: DataRepository): void {
  repository = next
}

/** Работает ли приложение на постоянном хранилище (данные переживут перезапуск). */
export function isPersistentStorage(): boolean {
  return getRepository().kind !== 'memory'
}
