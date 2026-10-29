import { ref } from 'vue'

/** Вид всплывающего уведомления. */
export type ToastKind = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id: number
  kind: ToastKind
  title: string
  message?: string
}

/** Очередь уведомлений общая для всего приложения. */
const toasts = ref<Toast[]>([])
let counter = 0

const DEFAULT_TIMEOUT = 4200

/** Убирает уведомление по идентификатору. */
function dismissToast(id: number): void {
  toasts.value = toasts.value.filter((toast) => toast.id !== id)
}

/** Добавляет уведомление. */
function pushToast(kind: ToastKind, title: string, message?: string, timeout = DEFAULT_TIMEOUT): number {
  counter += 1
  const id = counter
  toasts.value = [...toasts.value, { id, kind, title, message }]
  if (timeout > 0) {
    window.setTimeout(() => dismissToast(id), timeout)
  }
  return id
}

/** Простые уведомления для обратной связи по действиям пользователя. */
export function useToast() {
  return {
    toasts,
    dismiss: dismissToast,
    push: pushToast,
    success: (title: string, message?: string) => pushToast('success', title, message),
    error: (title: string, message?: string) => pushToast('error', title, message, 7000),
    info: (title: string, message?: string) => pushToast('info', title, message),
    warning: (title: string, message?: string) => pushToast('warning', title, message, 6000),
  }
}
