import { ref } from 'vue'

/** Параметры диалога подтверждения. */
export interface ConfirmOptions {
  title: string
  message?: string
  /** Дополнительные строки-пояснения (например, список зависимостей). */
  details?: string[]
  confirmLabel?: string
  cancelLabel?: string
  /** Красная кнопка подтверждения для разрушающих действий. */
  danger?: boolean
}

interface ConfirmState extends ConfirmOptions {
  open: boolean
}

const state = ref<ConfirmState | null>(null)
let resolver: ((value: boolean) => void) | null = null

/**
 * Диалог подтверждения с промис-интерфейсом:
 * const ok = await confirm({ title: 'Удалить?' })
 */
export function useConfirm() {
  function confirm(options: ConfirmOptions): Promise<boolean> {
    // Закрываем предыдущий незавершённый диалог, чтобы не потерять промис.
    if (resolver) {
      resolver(false)
      resolver = null
    }
    state.value = { ...options, open: true }
    return new Promise<boolean>((resolve) => {
      resolver = resolve
    })
  }

  function close(result: boolean): void {
    state.value = null
    if (resolver) {
      resolver(result)
      resolver = null
    }
  }

  return {
    state,
    confirm,
    accept: () => close(true),
    cancel: () => close(false),
  }
}
