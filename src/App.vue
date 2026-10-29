<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { RouterView, useRouter } from 'vue-router'
import AppLayout from '@/components/layout/AppLayout.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import ToastHost from '@/components/ui/ToastHost.vue'
import { useAutoPersist } from '@/composables/useAutoPersist'
import { useTheme } from '@/composables/useTheme'
import { initBackButton } from '@/services/back-button'
import { isPersistentStorage } from '@/services/repository'

// Автосохранение и тема оформления живут на уровне приложения.
const { lastSavedAt, error } = useAutoPersist()

// useTheme подписывается на системную тему, применяет класс .dark на <html>
// и переключает оформление строки состояния на телефоне.
useTheme()

const persistent = isPersistentStorage()
const router = useRouter()

/**
 * Системная кнопка «Назад» на Android:
 * закрывает открытое окно → возвращает по маршрутам → выходит из приложения.
 */
let stopBackButton: (() => void) | null = null

onMounted(() => {
  stopBackButton = initBackButton({
    canGoBack: () => Boolean(router.options.history.state.back),
    goBack: () => router.back(),
  })
})

onBeforeUnmount(() => {
  stopBackButton?.()
})
</script>

<template>
  <AppLayout :last-saved-at="lastSavedAt" :save-error="error" :persistent="persistent">
    <RouterView v-slot="{ Component }">
      <component :is="Component" />
    </RouterView>
  </AppLayout>

  <ToastHost />
  <ConfirmDialog />
</template>
