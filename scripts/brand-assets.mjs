/**
 * Генерация значка и заставки приложения.
 *
 * Рисуем и кодируем PNG вручную (zlib + CRC32), поэтому графические библиотеки
 * не нужны: изображения простые и полностью детерминированные. Скрипт создаёт
 * сразу и исходники в assets/, и готовые ресурсы Android в android/app/src/main/res.
 *
 * Запуск: npm run assets:source
 */
import { deflateSync } from 'node:zlib'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const assetsDir = join(projectRoot, 'assets')
const androidResDir = join(projectRoot, 'android', 'app', 'src', 'main', 'res')

/* --------------------------------- PNG ---------------------------------- */

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

const CRC_TABLE = new Int32Array(256)
for (let index = 0; index < 256; index += 1) {
  let value = index
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  }
  CRC_TABLE[index] = value
}

function crc32(buffer) {
  let crc = 0xffffffff
  for (let index = 0; index < buffer.length; index += 1) {
    crc = CRC_TABLE[(crc ^ buffer[index]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const typeBuffer = Buffer.from(type, 'latin1')
  const checksum = Buffer.alloc(4)
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0)
  return Buffer.concat([length, typeBuffer, data, checksum])
}

/** Кодирует RGBA-буфер в PNG (8 бит на канал, без интерлейса). */
function encodePng(width, height, rgba) {
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0 // фильтр строки: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }

  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8 // бит на канал
  header[9] = 6 // тип цвета: RGBA
  header[10] = 0
  header[11] = 0
  header[12] = 0

  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

/* --------------------------------- холст -------------------------------- */

const rgb = (hex) => [
  Number.parseInt(hex.slice(1, 3), 16),
  Number.parseInt(hex.slice(3, 5), 16),
  Number.parseInt(hex.slice(5, 7), 16),
]

function createCanvas(width, height) {
  const data = Buffer.alloc(width * height * 4)
  return {
    width,
    height,
    data,
    /** Накладывает цвет с заданной прозрачностью (обычное альфа-смешение). */
    blend(x, y, color, alpha) {
      if (alpha <= 0 || x < 0 || y < 0 || x >= width || y >= height) return
      const offset = (y * width + x) * 4
      const dstAlpha = data[offset + 3] / 255
      const outAlpha = alpha + dstAlpha * (1 - alpha)
      if (outAlpha <= 0) return
      for (let channel = 0; channel < 3; channel += 1) {
        const src = color[channel]
        const dst = data[offset + channel]
        data[offset + channel] = Math.round(
          (src * alpha + dst * dstAlpha * (1 - alpha)) / outAlpha,
        )
      }
      data[offset + 3] = Math.round(outAlpha * 255)
    },
  }
}

/** Заливает область по предикату формы со сглаживанием (2×2 субпикселя). */
function fillShape(canvas, color, inside, bounds) {
  const sub = 2
  const step = 1 / sub
  const x0 = Math.max(0, Math.floor(bounds.x0))
  const x1 = Math.min(canvas.width - 1, Math.ceil(bounds.x1))
  const y0 = Math.max(0, Math.floor(bounds.y0))
  const y1 = Math.min(canvas.height - 1, Math.ceil(bounds.y1))

  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      let hits = 0
      for (let sy = 0; sy < sub; sy += 1) {
        for (let sx = 0; sx < sub; sx += 1) {
          if (inside(x + (sx + 0.5) * step, y + (sy + 0.5) * step)) hits += 1
        }
      }
      if (hits > 0) canvas.blend(x, y, color, hits / (sub * sub))
    }
  }
}

const roundedRectInside = (px, py, x, y, width, height, radius) => {
  if (px < x || px > x + width || py < y || py > y + height) return false
  const cx = Math.min(Math.max(px, x + radius), x + width - radius)
  const cy = Math.min(Math.max(py, y + radius), y + height - radius)
  const dx = px - cx
  const dy = py - cy
  return dx * dx + dy * dy <= radius * radius
}

const circleInside = (px, py, cx, cy, radius) => {
  const dx = px - cx
  const dy = py - cy
  return dx * dx + dy * dy <= radius * radius
}

const rect = (x, y, width, height, radius = 0) => ({
  inside: (px, py) => roundedRectInside(px, py, x, y, width, height, radius),
  bounds: { x0: x, y0: y, x1: x + width, y1: y + height },
})

const circle = (cx, cy, radius) => ({
  inside: (px, py) => circleInside(px, py, cx, cy, radius),
  bounds: { x0: cx - radius, y0: cy - radius, x1: cx + radius, y1: cy + radius },
})

const fillAll = (canvas, color) =>
  fillShape(canvas, color, () => true, {
    x0: 0,
    y0: 0,
    x1: canvas.width,
    y1: canvas.height,
  })

/* --------------------------------- значок ------------------------------- */

const BRAND = '#2563eb'
const CHIP_COLORS = ['#16a34a', '#2563eb', '#7c3aed']

/**
 * Рисует мотив «календарь со сменами».
 * Все размеры считаются от стороны квадрата S, центр — (centerX, centerY).
 */
function drawCalendarMotif(canvas, centerX, centerY, S) {
  const left = centerX - S / 2
  const top = centerY - S / 2
  const p = (ratio) => ratio * S

  // Подвесы
  for (const offset of [0.32, 0.58]) {
    const bar = rect(left + p(offset), top + p(0.16), p(0.1), p(0.16), p(0.05))
    fillShape(canvas, rgb('#ffffff'), bar.inside, bar.bounds)
  }

  // Корпус
  const body = rect(left + p(0.17), top + p(0.26), p(0.66), p(0.56), p(0.09))
  fillShape(canvas, rgb('#ffffff'), body.inside, body.bounds)

  // Шапка календаря
  const header = rect(left + p(0.25), top + p(0.42), p(0.5), p(0.045), p(0.022))
  fillShape(canvas, rgb('#93c5fd'), header.inside, header.bounds)

  // Смены (цвета совпадают с типами смен в приложении)
  CHIP_COLORS.forEach((hex, index) => {
    const chip = rect(left + p(0.25 + index * 0.17), top + p(0.56), p(0.14), p(0.14), p(0.035))
    fillShape(canvas, rgb(hex), chip.inside, chip.bounds)
  })
}

/** Квадратный значок: фон во всю площадь + мотив. */
function squareIcon(size, background = BRAND) {
  const canvas = createCanvas(size, size)
  if (background) fillAll(canvas, rgb(background))
  drawCalendarMotif(canvas, size / 2, size / 2, size)
  return canvas
}

/** Круглый значок: круглый фон + мотив. */
function roundIcon(size, background = BRAND) {
  const canvas = createCanvas(size, size)
  fillShape(canvas, rgb(background), circle(size / 2, size / 2, size / 2).inside, {
    x0: 0,
    y0: 0,
    x1: size,
    y1: size,
  })
  drawCalendarMotif(canvas, size / 2, size / 2, size)
  return canvas
}

/**
 * Передний план адаптивного значка: прозрачный фон,
 * мотив занимает центральные 62 % — безопасную зону.
 */
function adaptiveForeground(size) {
  const canvas = createCanvas(size, size)
  drawCalendarMotif(canvas, size / 2, size / 2, size * 0.62)
  return canvas
}

/** Заставка: фирменный фон и мотив по центру (одинаково смотрится в обеих темах). */
function splash(width, height, background = BRAND) {
  const canvas = createCanvas(width, height)
  fillAll(canvas, rgb(background))
  drawCalendarMotif(canvas, width / 2, height / 2, Math.min(width, height) * 0.42)
  return canvas
}

/* --------------------------------- запись ------------------------------- */

function writePng(file, canvas) {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, encodePng(canvas.width, canvas.height, canvas.data))
}

/** Плотности Android и соответствующие размеры ресурсов. */
const DENSITIES = [
  { name: 'mdpi', launcher: 48, foreground: 108, port: [320, 480], land: [480, 320] },
  { name: 'hdpi', launcher: 72, foreground: 162, port: [480, 800], land: [800, 480] },
  { name: 'xhdpi', launcher: 96, foreground: 216, port: [720, 1280], land: [1280, 720] },
  { name: 'xxhdpi', launcher: 144, foreground: 324, port: [960, 1600], land: [1600, 960] },
  { name: 'xxxhdpi', launcher: 192, foreground: 432, port: [1280, 1920], land: [1920, 1280] },
]

console.log('Исходники для значков и заставки (assets/):')
writePng(join(assetsDir, 'icon-only.png'), squareIcon(1024))
writePng(join(assetsDir, 'icon-background.png'), squareIcon(1024))
writePng(join(assetsDir, 'icon-foreground.png'), adaptiveForeground(1024))
writePng(join(assetsDir, 'splash.png'), splash(2732, 2732, '#f1f5f9'))
writePng(join(assetsDir, 'splash-dark.png'), splash(2732, 2732, '#020617'))
console.log('  icon-only.png, icon-background.png, icon-foreground.png, splash.png, splash-dark.png')

const hasAndroid = existsSync(androidResDir)

if (!hasAndroid) {
  console.log('\nПроект Android не найден — ресурсы платформы пропущены (npm run android:add).')
} else {
  console.log('\nРесурсы Android (android/app/src/main/res):')

  for (const density of DENSITIES) {
    writePng(join(androidResDir, `mipmap-${density.name}`, 'ic_launcher.png'), squareIcon(density.launcher))
    writePng(
      join(androidResDir, `mipmap-${density.name}`, 'ic_launcher_round.png'),
      roundIcon(density.launcher),
    )
    writePng(
      join(androidResDir, `mipmap-${density.name}`, 'ic_launcher_foreground.png'),
      adaptiveForeground(density.foreground),
    )
    writePng(
      join(androidResDir, `drawable-port-${density.name}`, 'splash.png'),
      splash(density.port[0], density.port[1]),
    )
    writePng(
      join(androidResDir, `drawable-land-${density.name}`, 'splash.png'),
      splash(density.land[0], density.land[1]),
    )
    console.log(`  ${density.name}: значок ${density.launcher}px, круглый, адаптивный, заставки`)
  }

  // Заставка по умолчанию (без указания плотности)
  writePng(join(androidResDir, 'drawable', 'splash.png'), splash(480, 320))
  console.log('  drawable/splash.png (по умолчанию)')

  // Цвет фона адаптивного значка
  writeFileSync(
    join(androidResDir, 'values', 'ic_launcher_background.xml'),
    `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">${BRAND.toUpperCase()}</color>
</resources>
`,
    'utf8',
  )

  // Цвета приложения. Шаблон Capacitor ссылается на них из styles.xml,
  // но в проекте их нет — определяем явно, чтобы сборка не зависела от библиотеки.
  writeFileSync(
    join(androidResDir, 'values', 'colors.xml'),
    `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="colorPrimary">${BRAND.toUpperCase()}</color>
    <color name="colorPrimaryDark">#1D4ED8</color>
    <color name="colorAccent">#16A34A</color>
    <color name="splashBackground">${BRAND.toUpperCase()}</color>
</resources>
`,
    'utf8',
  )
  console.log('  values/ic_launcher_background.xml, values/colors.xml')
}

console.log('\nГотово. Не забудьте: npm run android:sync')
