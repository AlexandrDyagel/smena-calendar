<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { useBackHandler } from '@/composables/useBackHandler'
import AppButton from './AppButton.vue'
import AppIcon from './AppIcon.vue'

const props = withDefaults(
  defineProps<{
    title?: string
    subtitle?: string
    size?: 'sm' | 'md' | 'lg' | 'xl'
    closeOnBackdrop?: boolean
    /**
     * Скрыть нижнюю панель по умолчанию (кнопка «Закрыть»).
     * Если передан слот footer, он всё равно отрисуется — так окна
     * со своими кнопками («Сохранить», «Удалить») не теряют их.
     */
    hideFooter?: boolean
    footerAlign?: 'start' | 'end' | 'between'
  }>(),
  { size: 'md', closeOnBackdrop: true, footerAlign: 'end' },
)

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ close: [] }>()

const SIZE_CLASSES: Record<string, string> = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
  xl: 'max-w-6xl',
}

const panelClass = computed(() => SIZE_CLASSES[props.size] ?? SIZE_CLASSES.md)

const footerClass = computed(() => {
  if (props.footerAlign === 'start') return 'justify-start'
  if (props.footerAlign === 'between') return 'justify-between'
  return 'justify-end'
})

function close(): void {
  open.value = false
  emit('close')
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && open.value) {
    event.stopPropagation()
    close()
  }
}

watch(open, (value) => {
  // Блокируем прокрутку фона, пока открыто модальное окно.
  document.body.style.overflow = value ? 'hidden' : ''
})

// На Android системная кнопка «Назад» закрывает окно, а не приложение.
useBackHandler(open, close)

onMounted(() => window.addEventListener('keydown', onKeydown))

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <Transition name="sc-fade">
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-3 backdrop-blur-sm sm:p-6"
        role="presentation"
        @click.self="closeOnBackdrop && close()"
      >
        <div
          class="my-4 w-full rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
          :class="panelClass"
          role="dialog"
          aria-modal="true"
        >
          <header
            v-if="title || $slots.header"
            class="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-700"
          >
            <div class="min-w-0">
              <slot name="header">
                <h2 class="truncate text-base font-semibold text-slate-900 dark:text-slate-100">
                  {{ title }}
                </h2>
                <p v-if="subtitle" class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {{ subtitle }}
                </p>
              </slot>
            </div>
            <button
              type="button"
              class="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              aria-label="Закрыть"
              @click="close"
            >
              <AppIcon name="close" :size="18" />
            </button>
          </header>

          <div class="sc-scroll max-h-[70vh] overflow-y-auto px-5 py-4">
            <slot />
          </div>

          <footer
            v-if="!hideFooter || $slots.footer"
            class="flex flex-wrap items-center gap-2 border-t border-slate-200 px-5 py-3 dark:border-slate-700"
            :class="footerClass"
          >
            <slot name="footer">
              <AppButton variant="secondary" @click="close">Закрыть</AppButton>
            </slot>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
