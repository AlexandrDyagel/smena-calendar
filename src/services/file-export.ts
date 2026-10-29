import { Capacitor } from '@capacitor/core'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { downloadBlob } from '@/utils/export'

/**
 * Сохранение текстовых файлов (CSV, JSON, iCal).
 *
 * В браузере достаточно Blob + ссылки на скачивание, но внутри WebView на Android
 * такой способ ничего не делает: файл нужно записать через Filesystem и предложить
 * пользователю «Поделиться» (сохранить в Загрузки, отправить в мессенджер и т.п.).
 */

/** Папка внутри документов приложения. */
const DEVICE_FOLDER = 'smena-calendar'

export interface FileSaveResult {
  ok: boolean
  /** Куда сохранён файл — показывается пользователю. */
  location?: string
  error?: string
}

/** Сохраняет текстовый файл подходящим для платформы способом. */
export async function saveTextFile(
  filename: string,
  content: string,
  mime: string,
): Promise<FileSaveResult> {
  if (!Capacitor.isNativePlatform()) {
    downloadBlob(filename, content, mime)
    return { ok: true, location: 'папка загрузок браузера' }
  }

  try {
    const written = await Filesystem.writeFile({
      path: `${DEVICE_FOLDER}/${filename}`,
      data: content,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
      recursive: true,
    })

    try {
      await Share.share({
        title: filename,
        text: 'Файл из приложения «Календарь смен»',
        files: [written.uri],
        dialogTitle: 'Файл сохранён — отправить или сохранить в другое место?',
      })
    } catch {
      // Пользователь закрыл системное окно «Поделиться» — файл уже записан.
    }

    return { ok: true, location: `«Документы/${DEVICE_FOLDER}» на устройстве` }
  } catch (error) {
    return {
      ok: false,
      error: `Не удалось сохранить файл: ${
        error instanceof Error ? error.message : String(error)
      }`,
    }
  }
}

/** Открывать ли системное окно «Поделиться» сразу после сохранения. */
export function isNativeFileExport(): boolean {
  return Capacitor.isNativePlatform()
}
