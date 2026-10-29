import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'

/**
 * Тактильный отклик (вибрация) на действия пользователя.
 *
 * Работает только в нативном приложении: в браузере и на устройствах
 * с отключённой вибрацией вызовы тихо игнорируются, поэтому интерфейс
 * можно вызывать без дополнительных проверок.
 */

export type FeedbackKind = 'tap' | 'success' | 'warning' | 'error'

export async function feedback(kind: FeedbackKind = 'tap'): Promise<void> {
  if (!Capacitor.isNativePlatform()) return

  try {
    switch (kind) {
      case 'success':
        await Haptics.notification({ type: NotificationType.Success })
        break
      case 'warning':
        await Haptics.notification({ type: NotificationType.Warning })
        break
      case 'error':
        await Haptics.notification({ type: NotificationType.Error })
        break
      default:
        await Haptics.impact({ style: ImpactStyle.Light })
        break
    }
  } catch {
    // Пользователь мог отключить вибрацию в настройках устройства.
  }
}
