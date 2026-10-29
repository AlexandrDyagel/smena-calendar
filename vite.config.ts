import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

/**
 * Конфигурация сборки.
 * Псевдоним "@" ведёт на каталог src — так импорты остаются короткими
 * и не зависят от глубины вложенности файла.
 */
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  // Относительные пути к ресурсам: сборка одинаково работает и на веб-хостинге,
  // и внутри APK Capacitor (там приложение отдаётся с https://localhost).
  base: './',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    open: false,
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
})
