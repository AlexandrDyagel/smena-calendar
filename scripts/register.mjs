// Загрузчик разрешения модулей для самопроверки логики (npm run check:logic).
// Нужен потому, что Node не умеет сам разрешать псевдоним "@/..."
// и импорты без расширения, которые используются в исходниках.
import { registerHooks } from 'node:module'
import { existsSync, statSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const srcDir = path.join(projectRoot, 'src')

function isFile(candidate) {
  try {
    return existsSync(candidate) && statSync(candidate).isFile()
  } catch {
    return false
  }
}

function probe(basePath) {
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.mts`,
    `${basePath}.js`,
    `${basePath}.mjs`,
    path.join(basePath, 'index.ts'),
    path.join(basePath, 'index.js'),
  ]
  for (const candidate of candidates) {
    if (isFile(candidate)) return candidate
  }
  return null
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/')) {
      const target = probe(path.join(srcDir, specifier.slice(2)))
      if (target) return { url: pathToFileURL(target).href, shortCircuit: true }
    }

    if (specifier.startsWith('./') || specifier.startsWith('../')) {
      const parentPath = fileURLToPath(context.parentURL)
      const target = probe(path.resolve(path.dirname(parentPath), specifier))
      if (target) return { url: pathToFileURL(target).href, shortCircuit: true }
    }

    if (specifier.startsWith('dayjs/locale/')) {
      const target = probe(path.join(projectRoot, 'node_modules', specifier))
      if (target) return { url: pathToFileURL(target).href, shortCircuit: true }
    }

    return nextResolve(specifier, context)
  },
})
