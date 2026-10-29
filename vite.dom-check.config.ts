import { fileURLToPath, URL } from 'node:url'
import path from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

/**
 * Сборка проверки взаимодействия (scripts/dom-check.ts).
 *
 * Отличия от обычной SSR-сборки:
 * — шаблоны компилируются в клиентские render-функции (нужны для монтирования в DOM);
 * — внешние пакеты остаются внешними, поэтому динамические импорты внутри проверки
 *   выполняются уже после подстановки DOM-заглушек jsdom.
 */
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  logLevel: 'warn',
  build: {
    outDir: '.tmp/dom-check',
    emptyOutDir: true,
    target: 'esnext',
    minify: false,
    sourcemap: false,
    rollupOptions: {
      input: fileURLToPath(new URL('./scripts/dom-check.ts', import.meta.url)),
      // Псевдоним «@/» и локальные файлы собираем в бандл, пакеты — оставляем внешними.
      external: (id: string) => {
        if (id.startsWith('@/') || id.startsWith('.') || id.startsWith('\0')) return false
        // Локаль dayjs собираем внутрь: Node не разрешает путь без расширения (.js).
        if (id.startsWith('dayjs/locale/')) return false
        if (path.isAbsolute(id)) return false
        return true
      },
      output: {
        format: 'es',
        entryFileNames: 'dom-check.mjs',
        chunkFileNames: 'chunk-[name].mjs',
      },
    },
  },
})
