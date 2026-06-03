import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { writeLog } from './log'

export type LintStrategy = 'eslint' | 'oxlint'

export interface LintStrategyCache {
  strategy: LintStrategy
  eslintVersion?: string
  sniffedAt: string
}

/** In-memory strategy cache, keyed by project cwd. */
const strategyCache = new Map<string, LintStrategyCache>()

function getCachePath(cwd: string): string {
  return join(cwd, '.omp', 'lint-strategy.json')
}

/**
 * Read eslint version from package.json (dependencies + devDependencies).
 */
function sniffEslintVersion(cwd: string): string | undefined {
  try {
    const pkgPath = join(cwd, 'package.json')
    if (!existsSync(pkgPath))
      return undefined

    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as Record<string, unknown>
    const deps = {
      ...(pkg.devDependencies as Record<string, string> | undefined),
      ...(pkg.dependencies as Record<string, string> | undefined),
    }
    const raw = deps.eslint
    if (!raw)
      return undefined

    // Strip workspace/caret/tilde prefixes: "^9.1.0" → "9.1.0"
    const clean = raw.replace(/^\D*/, '')
    return clean || undefined
  }
  catch {
    return undefined
  }
}

function isEslintGte(version: string, major: number): boolean {
  const parts = version.split('.')
  const v = Number.parseInt(parts[0] ?? '0', 10)
  return !Number.isNaN(v) && v >= major
}

/**
 * Sniff lint strategy for a project and persist to .omp/lint-strategy.json.
 */
function sniffStrategy(cwd: string): LintStrategyCache {
  const eslintVersion = sniffEslintVersion(cwd)
  const strategy: LintStrategy = eslintVersion && isEslintGte(eslintVersion, 9) ? 'eslint' : 'oxlint'

  const cache: LintStrategyCache = {
    strategy,
    eslintVersion,
    sniffedAt: new Date().toISOString(),
  }

  // Persist
  try {
    const cacheDir = join(cwd, '.omp')
    if (!existsSync(cacheDir))
      mkdirSync(cacheDir, { recursive: true })
    writeFileSync(getCachePath(cwd), JSON.stringify(cache, null, 2))
  }
  catch {
    // Non-critical; we'll re-sniff next session
  }

  writeLog('INFO', `sniffed strategy for ${cwd}: ${strategy}${eslintVersion ? ` (eslint@${eslintVersion})` : ''}`)
  return cache
}

/**
 * Load strategy from cache or sniff fresh.
 */
export function loadStrategy(cwd: string): LintStrategyCache {
  const cached = strategyCache.get(cwd)
  if (cached)
    return cached

  // Try reading persisted cache
  const cachePath = getCachePath(cwd)
  if (existsSync(cachePath)) {
    try {
      const data = JSON.parse(readFileSync(cachePath, 'utf8')) as LintStrategyCache
      if (data.strategy === 'eslint' || data.strategy === 'oxlint') {
        strategyCache.set(cwd, data)
        return data
      }
    }
    catch {
      // Corrupt cache; re-sniff
    }
  }

  const result = sniffStrategy(cwd)
  strategyCache.set(cwd, result)
  return result
}
