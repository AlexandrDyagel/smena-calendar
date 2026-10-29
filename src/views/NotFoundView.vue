<script setup lang="ts">
import EmptyState from '@/components/ui/EmptyState.vue'
import AppButton from '@/components/ui/AppButton.vue'
</script>

<template>
  <EmptyState
    icon="alert"
    title="Страница не найдена"
    description="Возможно, ссылка устарела. Вернитесь в календарь, чтобы продолжить работу с графиками."
  >
    <RouterLink to="/calendar">
      <AppButton variant="primary" size="sm">Вернуться в календарь</AppButton>
    </RouterLink>
  </EmptyState>
</template>
