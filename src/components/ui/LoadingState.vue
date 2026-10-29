<script setup lang="ts">
withDefaults(defineProps<{ title?: string; rows?: number }>(), {
  title: 'Загрузка данных…',
  rows: 4,
})
</script>

<template>
  <div class="space-y-3" role="status" aria-live="polite">
    <p class="text-sm text-slate-500 dark:text-slate-400">{{ title }}</p>
    <div class="space-y-2">
      <div
        v-for="row in rows"
        :key="row"
        class="h-10 animate-pulse rounded-lg bg-slate-200/70 dark:bg-slate-800"
        :style="{ opacity: 1 - row * 0.12 }"
      />
    </div>
  </div>
</template>
