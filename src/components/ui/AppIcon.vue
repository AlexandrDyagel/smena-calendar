<script setup lang="ts">
import { computed } from 'vue'

/** Набор встроенных иконок (контурные, 24×24). */
const ICONS: Record<string, string> = {
  calendar:
    '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>',
  users:
    '<path d="M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20"/><circle cx="9.5" cy="7.5" r="3.5"/><path d="M17 11a3 3 0 1 0 0-6"/><path d="M21 20v-1.5a4 4 0 0 0-3-3.85"/>',
  layers: '<path d="M12 3 3 8l9 5 9-5-9-5Z"/><path d="m3 13 9 5 9-5"/>',
  chart:
    '<path d="M3 20h18"/><path d="M6 20V11"/><path d="M11 20V5"/><path d="M16 20v-6"/><path d="M21 20v-3"/>',
  database:
    '<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  pencil: '<path d="m4 20h4L18.5 9.5a2.83 2.83 0 0 0-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
  trash: '<path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/>',
  copy:
    '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
  check: '<path d="m5 13 4 4L19 7"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  chevronLeft: '<path d="m14 6-6 6 6 6"/>',
  chevronRight: '<path d="m10 6 6 6-6 6"/>',
  chevronDown: '<path d="m6 10 6 6 6-6"/>',
  sun:
    '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/>',
  monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  filter: '<path d="M4 5h16l-6 7v6l-4 2v-8L4 5Z"/>',
  download: '<path d="M12 3v12M7 11l5 5 5-5M4 20h16"/>',
  upload: '<path d="M12 17V5M7 9l5-5 5 5M4 20h16"/>',
  alert: '<path d="M12 4 2 20h20L12 4Z"/><path d="M12 10v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  refresh:
    '<path d="M20 11A8 8 0 0 0 6.3 6.3L4 8.5"/><path d="M4 4v4.5h4.5"/><path d="M4 13a8 8 0 0 0 13.7 4.7L20 15.5"/><path d="M20 20v-4.5h-4.5"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  star: '<path d="m12 4 2.4 5 5.6.8-4 3.9 1 5.5L12 16.6 6.9 19.2l1-5.5-4-3.9 5.6-.8L12 4Z"/>',
  building:
    '<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M9 7h.01M12 7h.01M15 7h.01M9 11h.01M12 11h.01M15 11h.01"/><path d="M10 21v-4h4v4"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="2.5"/>',
  archive:
    '<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4"/>',
  settings:
    '<circle cx="12" cy="12" r="3.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  swap: '<path d="M7 4v13M7 4 4 7M7 4l3 3"/><path d="M17 20V7M17 20l3-3M17 20l-3-3"/>',
}

const props = withDefaults(
  defineProps<{
    name: string
    size?: number | string
    /** Толщина линии. */
    strokeWidth?: number
  }>(),
  { size: 18, strokeWidth: 1.8 },
)

const markup = computed(() => ICONS[props.name] ?? ICONS.info!)
const pixels = computed(() => (typeof props.size === 'number' ? `${props.size}px` : props.size))
</script>

<template>
  <svg
    :width="pixels"
    :height="pixels"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    class="shrink-0"
    v-html="markup"
  />
</template>
