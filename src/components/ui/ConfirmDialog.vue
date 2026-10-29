<script setup lang="ts">
import { computed } from 'vue'
import { useConfirm } from '@/composables/useConfirm'
import { feedback } from '@/services/feedback'
import AppButton from './AppButton.vue'
import AppIcon from './AppIcon.vue'
import AppModal from './AppModal.vue'

/**
 * Глобальный диалог подтверждения.
 * Управляется через composable useConfirm(): const ok = await confirm({...}).
 */
const { state, accept, cancel } = useConfirm()

/** Подтверждение опасного действия сопровождаем тактильным откликом. */
function onAccept(): void {
  void feedback(state.value?.danger ? 'warning' : 'tap')
  accept()
}

const isOpen = computed({
  get: () => Boolean(state.value?.open),
  set: (value: boolean) => {
    if (!value) cancel()
  },
})
</script>

<template>
  <AppModal
    v-model:open="isOpen"
    size="sm"
    :title="state?.title"
    :close-on-backdrop="false"
  >
    <div class="flex gap-3">
      <div
        class="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
        :class="
          state?.danger
            ? 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400'
            : 'bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400'
        "
      >
        <AppIcon :name="state?.danger ? 'alert' : 'info'" :size="18" />
      </div>

      <div class="min-w-0 flex-1 space-y-2">
        <p v-if="state?.message" class="text-sm text-slate-700 dark:text-slate-300">
          {{ state.message }}
        </p>

        <ul
          v-if="state?.details?.length"
          class="list-inside list-disc space-y-1 text-xs text-slate-500 dark:text-slate-400"
        >
          <li v-for="detail in state.details" :key="detail">{{ detail }}</li>
        </ul>
      </div>
    </div>

    <template #footer>
      <AppButton variant="secondary" @click="cancel">
        {{ state?.cancelLabel ?? 'Отмена' }}
      </AppButton>
      <AppButton :variant="state?.danger ? 'danger' : 'primary'" @click="onAccept">
        {{ state?.confirmLabel ?? 'Подтвердить' }}
      </AppButton>
    </template>
  </AppModal>
</template>
