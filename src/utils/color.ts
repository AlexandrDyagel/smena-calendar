/** Работа с цветами: прозрачность, контраст, осветление. */

/** Приводит HEX-цвет к виду #rrggbb; при ошибке возвращает запасной цвет. */
export function normalizeHex(value: unknown, fallback = '#64748b'): string {
  if (typeof value !== 'string') return fallback
  const hex = value.trim()
  if (/^#[0-9a-f]{6}$/i.test(hex)) return hex.toLowerCase()
  if (/^#[0-9a-f]{3}$/i.test(hex)) {
    const [, r, g, b] = hex.toLowerCase()
    return `#${r}${r}${g}${g}${b}${b}`
  }
  return fallback
}

/** Разбирает HEX в компоненты 0..255. */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const value = normalizeHex(hex)
  return {
    r: Number.parseInt(value.slice(1, 3), 16),
    g: Number.parseInt(value.slice(3, 5), 16),
    b: Number.parseInt(value.slice(5, 7), 16),
  }
}

/** Цвет с заданной прозрачностью: `withAlpha('#16a34a', 0.15)`. */
export function withAlpha(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex)
  const a = Math.min(Math.max(alpha, 0), 1)
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

/** Смешивает цвет с белым (amount > 0) или с чёрным (amount < 0). */
export function shade(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex)
  const target = amount >= 0 ? 255 : 0
  const ratio = Math.abs(amount)
  const mix = (channel: number) => Math.round(channel + (target - channel) * ratio)
  const toHex = (channel: number) => channel.toString(16).padStart(2, '0')
  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`
}

/** Относительная яркость по WCAG. */
export function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex)
  const channel = (value: number) => {
    const c = value / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** Подбирает читаемый цвет текста (белый или почти чёрный) для фона. */
export function textOn(hex: string): string {
  return luminance(hex) > 0.55 ? '#0f172a' : '#ffffff'
}

/** Палитра для назначения цветов работникам и шаблонам. */
export const COLOR_PALETTE: string[] = [
  '#2563eb',
  '#16a34a',
  '#dc2626',
  '#d97706',
  '#7c3aed',
  '#0891b2',
  '#db2777',
  '#65a30d',
  '#0d9488',
  '#4f46e5',
  '#ea580c',
  '#475569',
]

/** Выбирает цвет из палитры по индексу (по кругу). */
export function paletteColor(index: number): string {
  return COLOR_PALETTE[((index % COLOR_PALETTE.length) + COLOR_PALETTE.length) % COLOR_PALETTE.length]
}
