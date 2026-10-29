<script setup lang="ts">
import { useToast } from '@/composables/useToast'
import AppIcon from './AppIcon.vue'

const { toasts, dismiss } = useToast()

const STYLES: Record<string, { wrapper: string; icon: string; name: string }> = {
  success: {
    wrapper: 'border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10',
    icon: 'text-emerald-600 dark:text-emerald-400',
    name: 'check',
  },
  error: {
    wrapper: 'border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10',
    icon: 'text-red-600 dark:text-red-400',
    name: 'alert',
  },
  warning: {
    wrapper: 'border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10',
    icon: 'text-amber-600 dark:text-amber-400',
    name: 'alert',
  },
  info: {
    wrapper: 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900',
    icon: 'text-blue-600 dark:text-blue-400',
    name: 'info',
  },
}

function styleFor(kind: string) {
  return STYLES[kind] ?? STYLES.info!
}
</script>

<template>
  <div
    class="sc-no-print pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2"
    aria-live="polite"
  >
    <TransitionGroup name="sc-pop">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="pointer-events-auto flex items-start gap-3 rounded-xl border p-3 shadow-lg"
        :class="styleFor(toast.kind).wrapper"
      >
        <AppIcon
          :name="styleFor(toast.kind).name"
          :size="18"
          class="mt-0.5"
          :class="styleFor(toast.kind).icon"
        />
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium text-slate-800 dark:text-slate-100">{{ toast.title }}</p>
          <p v-if="toast.message" class="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
            {{ toast.message }}
          </p>
        </div>
        <button
          type="button"
          class="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          aria-label="Закрыть уведомление"
          @click="dismiss(toast.id)"
        >
          <AppIcon name="close" :size="14" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>
