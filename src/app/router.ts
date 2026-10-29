import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import { APP_TITLE } from '@/services/migrations'

/**
 * Маршрутизация.
 * Используется hash-режим: приложение полностью статическое, поэтому
 * прямые ссылки вида /#/templates работают при открытии файла с любого хостинга
 * и не требуют настройки fallback на сервере.
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/calendar',
  },
  {
    path: '/calendar',
    name: 'calendar',
    component: () => import('@/views/CalendarView.vue'),
    meta: { title: 'Календарь' },
  },
  {
    path: '/templates',
    name: 'templates',
    component: () => import('@/views/TemplatesView.vue'),
    meta: { title: 'Шаблоны графиков' },
  },
  {
    path: '/employees',
    name: 'employees',
    component: () => import('@/views/EmployeesView.vue'),
    meta: { title: 'Работники' },
  },
  {
    path: '/reports',
    name: 'reports',
    component: () => import('@/views/ReportsView.vue'),
    meta: { title: 'Отчёты' },
  },
  {
    path: '/data',
    name: 'data',
    component: () => import('@/views/DataView.vue'),
    meta: { title: 'Экспорт и импорт' },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue'),
    meta: { title: 'Страница не найдена' },
  },
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

router.afterEach((to) => {
  const pageTitle = typeof to.meta.title === 'string' ? to.meta.title : ''
  document.title = pageTitle ? `${pageTitle} — ${APP_TITLE}` : APP_TITLE
})
