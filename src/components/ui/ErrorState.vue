<script setup lang="ts">
import AppButton from './AppButton.vue'
import AppIcon from './AppIcon.vue'

withDefaults(
  defineProps<{
    title: string
    message?: string
    retryLabel?: string
  }>(),
  { retryLabel: 'Повторить' },
)

const emit = defineEmits<{ retry: [] }>()
</script>

<template>
  <div
    class="flex flex-col items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-500/30 dark:bg-red-500/10"
    role="alert"
  >
    <div class="flex items-start gap-3">
      <AppIcon name="alert" :size="20" class="mt-0.5 text-red-600 dark:text-red-400" />
      <div class="space-y-1">
        <h3 class="text-sm font-semibold text-red-800 dark:text-red-300">{{ title }}</h3>
        <p v-if="message" class="text-xs text-red-700 dark:text-red-300/80">{{ message }}</p>
      </div>
    </div>

    <div v-if="$slots.default" class="flex flex-wrap items-center gap-2">
      <slot />
    </div>
    <AppButton v-else-if="$attrs.onRetry" size="sm" variant="danger" @click="emit('retry')">
      {{ retryLabel }}
    </AppButton>
  </div>
</template>
