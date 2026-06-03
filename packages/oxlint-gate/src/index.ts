/**
 * lint-gate: Real-time lint quality gate for OMP.
 *
 * Intercepts Edit/Write tool calls and checks the target file after save.
 * Strategy is auto-detected per project:
 *   - ESLint ≥ 9 (e.g. antfu config) → project's own eslint --fix
 *   - Otherwise                       → global oxlint as fallback
 *
 * Cache: `.omp/lint-strategy.json` in project root.
 * Logs:  `~/.omp/logs/oxlint-gate.log`
 */

import type { ExtensionAPI, ExtensionFactory, ToolResultEventResult } from './omp-types'
import { spawnSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { isAbsolute, join, relative, resolve } from 'node:path'
import process from 'node:process'

const TS_EXTENSIONS = /\.(?:ts|tsx|mts|cts|vue)$/
const OXLINT_CFG = join(homedir(), '.config', 'oxlint', 'oxlintrc.json')
const LOG_DIR = join(homedir(), '.omp', 'logs')
const LOG_FILE = join(LOG_DIR, 'oxlint-gate.log')
const HOME = homedir()

// Tools that modify files
const WRITE_TOOLS = new Set(['edit', 'write'])

/** Max auto-fix attempts per file per turn. */
const MAX_FIX_ATTEMPTS = 3

/** Max lines of lint output to keep. */
const MAX_OUTPUT_LINES = 20

// ── Types ──────────────────────────────────────────────────────────────────

interface OxlintConfig {
  ignorePatterns?: string[]
}

type LintStrategy = 'eslint' | 'oxlint'

interface LintStrategyCache {
  strategy: LintStrategy
  eslintVersion?: string
  sniffedAt: string
}

// ── Local Logger ───────────────────────────────────────────────────────────

function ensureLogDir(): void {
  if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true })
  }
}

function writeLog(level: 'INFO' | 'WARN' | 'DEBUG', msg: string): void {
  try {
    ensureLogDir()
    const ts = new Date().toISOString()
    appendFileSync(LOG_FILE, `[${ts}] [${level}] ${msg}\n`)
  }
  catch {
    // Silently ignore log write failures
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function expandTilde(p: string): string {
  if (p === '~' || p.startsWith('~/')) {
    return join(HOME, p.slice(1))
  }
  return p
}

export function extractFilePath(input: Record<string, unknown>): string | undefined {
  // Direct `path` field (replace/patch modes of edit, and write tool)
  const directPath = input.path
  if (typeof directPath === 'string' && directPath)
    return directPath

  // Hashline / apply-patch modes: `input` is a raw string containing the path
  const rawInput = input.input
  if (typeof rawInput !== 'string' || !rawInput)
    return undefined

  // Hashline: ¶path#hash or §path#hash or @path#hash
  const hashlineMatch = /^[¶§@]([^\s#]+)/m.exec(rawInput)
  if (hashlineMatch?.[1])
    return hashlineMatch[1]

  // Apply-patch: *** Add/Update/Delete File: path
  const applyPatchMatch = /^\*\*\* (?:Add|Update|Delete) File:\s*(.+)/m.exec(rawInput)
  if (applyPatchMatch?.[1])
    return applyPatchMatch[1].trim()

  return undefined
}

function isExistingFile(p: string): boolean {
  try {
    return statSync(p).isFile()
  }
  catch {
    return false
  }
}

function loadIgnorePatterns(cfgPath: string): string[] {
  try {
    const raw = readFileSync(cfgPath, 'utf8')
    const cfg = JSON.parse(raw) as OxlintConfig
    if (!Array.isArray(cfg.ignorePatterns))
      return []
    return cfg.ignorePatterns.filter((p): p is string => typeof p === 'string')
  }
  catch {
    return []
  }
}

function matchesIgnorePattern(filePath: string, patterns: string[]): boolean {
  if (patterns.length === 0)
    return false

  const rel = relative(process.cwd(), filePath)
  const candidates = [filePath, rel, `./${rel}`]

  for (const pattern of patterns) {
    const regex = globToRegex(pattern)
    if (regex) {
      for (const c of candidates) {
        if (regex.test(c))
          return true
      }
    }
  }
  return false
}

function globToRegex(glob: string): RegExp | null {
  try {
    const regexStr = glob
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*/g, '{{DOUBLE_STAR}}')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '[^/]')
      .replace(/\{\{DOUBLE_STAR\}\}/g, '.*')

    return new RegExp(`^${regexStr}$`)
  }
  catch {
    return null
  }
}

function truncateOutput(output: string, maxLines: number = MAX_OUTPUT_LINES): string {
  const lines = output.split('\n')
  if (lines.length <= maxLines)
    return output
  const head = lines.slice(0, 10).join('\n')
  const summary = lines.slice(-5).join('\n')
  return `${head}\n\n... (${lines.length - 15} lines truncated) ...\n\n${summary}`
}

// ── Oxlint runner ─────────────────────────────────────────────────────

function runOxlint(filePath: string, cfgPath: string): { passed: boolean, output: string } {
  const result = spawnSync('oxlint', ['-c', cfgPath, filePath], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 5000,
  })

  if (result.error)
    return { passed: true, output: `oxlint error: ${result.error.message}` }

  const exitCode = result.status ?? -1
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim()
  return { passed: exitCode !== 1, output }
}

function runOxlintFix(filePath: string, cfgPath: string): { fixed: boolean, remaining: number, output: string } {
  const result = spawnSync('oxlint', ['--fix', '-c', cfgPath, filePath], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 10000,
  })

  if (result.error)
    return { fixed: false, remaining: -1, output: `oxlint error: ${result.error.message}` }

  const exitCode = result.status ?? -1
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim()
  return { fixed: exitCode === 0, remaining: exitCode === 1 ? 1 : 0, output }
}

// ── ESLint runner ─────────────────────────────────────────────────────

function runEslintCheck(filePath: string, cwd: string): { passed: boolean, output: string } {
  const result = spawnSync('npx', ['eslint', '--no-warn-ignored', filePath], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 10000,
    cwd,
  })

  if (result.error)
    return { passed: true, output: `eslint error: ${result.error.message}` }

  const exitCode = result.status ?? -1
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim()
  return { passed: exitCode !== 1, output }
}

function runEslintFix(filePath: string, cwd: string): { fixed: boolean, output: string } {
  // Try project's lint:fix script first, fall back to direct npx eslint --fix
  const result = spawnSync('npx', ['eslint', '--fix', filePath], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 15000,
    cwd,
  })

  if (result.error)
    return { fixed: false, output: `eslint error: ${result.error.message}` }

  const exitCode = result.status ?? -1
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim()
  // eslint: 0 = clean, 1 = lint errors remain, 2 = fatal
  return { fixed: exitCode === 0, output }
}

// ── Strategy sniffing ─────────────────────────────────────────────────

/** In-memory strategy cache, keyed by project cwd. */
const strategyCache = new Map<string, LintStrategyCache>()

function getCachePath(cwd: string): string {
  return join(cwd, '.omp', 'lint-strategy.json')
}

/**
 * Read eslint version from package.json (dependencies + devDependencies).
 * Returns the version string or undefined.
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
    const raw = deps['eslint']
    if (!raw)
      return undefined

    // Strip workspace/caret/tilde prefixes: "^9.1.0" → "9.1.0"
    const clean = raw.replace(/^[^0-9]*/, '')
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
function loadStrategy(cwd: string): LintStrategyCache {
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

// ── Extension state ───────────────────────────────────────────────────

const pendingPaths = new Map<string, { toolName: string, timestamp: number }>()
const fixCounters = new Map<string, number>()

// ── Strategy handlers ─────────────────────────────────────────────────

function handleEslintStrategy(
  pi: ExtensionAPI,
  filePath: string,
  cwd: string,
  fixCount: number,
  log: ExtensionAPI['logger'],
): undefined | ToolResultEventResult {
  // 1. Check first
  const { passed } = runEslintCheck(filePath, cwd)
  if (passed) {
    log.info(`[lint-gate] eslint passed: ${filePath}`)
    writeLog('INFO', `eslint passed: ${filePath}`)
    fixCounters.delete(filePath)
    return undefined
  }

  log.warn(`[lint-gate] eslint violations in ${filePath}, attempting auto-fix`)
  writeLog('WARN', `eslint violations in ${filePath}, attempting auto-fix`)

  // 2. Auto-fix
  fixCounters.set(filePath, fixCount + 1)
  const { fixed, output } = runEslintFix(filePath, cwd)

  if (fixed) {
    log.info(`[lint-gate] eslint auto-fixed: ${filePath}`)
    writeLog('INFO', `eslint auto-fixed: ${filePath}`)
    return {
      content: [{ type: 'text', text: `✅ [lint-gate] eslint auto-fixed ${filePath}` }],
    }
  }

  // 3. Remaining issues
  const remaining = truncateOutput(output)
  log.warn(`[lint-gate] eslint partial fix in ${filePath}`)
  writeLog('WARN', `eslint partial fix in ${filePath}`)

  pi.sendMessage(
    {
      customType: 'lint-gate',
      content: `⚠️ [lint-gate] ${filePath} has remaining eslint issues after auto-fix:\n\n${remaining}`,
      display: true,
      attribution: 'agent',
    },
    { triggerTurn: false },
  )
  return undefined
}

function handleOxlintStrategy(
  pi: ExtensionAPI,
  filePath: string,
  fixCount: number,
  log: ExtensionAPI['logger'],
): undefined | ToolResultEventResult {
  if (!existsSync(OXLINT_CFG))
    return undefined

  const ignorePatterns = loadIgnorePatterns(OXLINT_CFG)
  if (matchesIgnorePattern(filePath, ignorePatterns))
    return undefined

  // 1. Check for violations
  const { passed } = runOxlint(filePath, OXLINT_CFG)
  if (passed) {
    log.info(`[lint-gate] oxlint passed: ${filePath}`)
    writeLog('INFO', `oxlint passed: ${filePath}`)
    fixCounters.delete(filePath)
    return undefined
  }

  log.warn(`[lint-gate] oxlint violations in ${filePath}, attempting auto-fix`)
  writeLog('WARN', `oxlint violations in ${filePath}, attempting auto-fix`)

  // 2. Try auto-fix
  fixCounters.set(filePath, fixCount + 1)
  const fixResult = runOxlintFix(filePath, OXLINT_CFG)

  if (fixResult.fixed) {
    log.info(`[lint-gate] oxlint auto-fixed: ${filePath}`)
    writeLog('INFO', `oxlint auto-fixed: ${filePath}`)
    return {
      content: [{ type: 'text', text: `✅ [lint-gate] auto-fixed lint issues in ${filePath}` }],
    }
  }

  // 3. Some violations remain — report to LLM
  const remaining = truncateOutput(fixResult.output)
  log.warn(`[lint-gate] oxlint partial fix in ${filePath}, remaining issues`)
  writeLog('WARN', `oxlint partial fix in ${filePath}`)

  pi.sendMessage(
    {
      customType: 'lint-gate',
      content: `⚠️ [lint-gate] ${filePath} has remaining lint issues after auto-fix:\n\n${remaining}`,
      display: true,
      attribution: 'agent',
    },
    { triggerTurn: false },
  )
  return undefined
}

// ── Extension factory ─────────────────────────────────────────────────

const oxlintGate: ExtensionFactory = (pi: ExtensionAPI): void => {
  const log = pi.logger

  log.info('[lint-gate] extension loaded (auto-fix mode)')
  writeLog('INFO', 'extension loaded (auto-fix mode)')

  // ── session_start: pre-warm strategy cache ──────────────────────
  pi.on('session_start', async (_event, ctx) => {
    const strategy = loadStrategy(ctx.cwd)
    log.info(`[lint-gate] project strategy: ${strategy.strategy}${strategy.eslintVersion ? ` (eslint@${strategy.eslintVersion})` : ''}`)
  })

  // ── tool_call: record file path, don't block ────────────────────────
  pi.on('tool_call', async (event, ctx) => {
    if (!WRITE_TOOLS.has(event.toolName))
      return

    const extractedPath = extractFilePath(event.input as Record<string, unknown>)
    if (!extractedPath)
      return

    const expandedPath = expandTilde(extractedPath)
    const filePath = isAbsolute(expandedPath) ? expandedPath : resolve(ctx.cwd, expandedPath)

    if (!TS_EXTENSIONS.test(filePath))
      return
    if (!isExistingFile(filePath))
      return

    pendingPaths.set(filePath, { toolName: event.toolName, timestamp: Date.now() })
    return undefined
  })

  // ── tool_result: check & auto-fix ───────────────────────────────────
  pi.on('tool_result', async (event, ctx) => {
    if (!WRITE_TOOLS.has(event.toolName))
      return

    const extractedPath = extractFilePath(event.input as Record<string, unknown>)
    if (!extractedPath)
      return

    const expandedPath = expandTilde(extractedPath)
    const filePath = isAbsolute(expandedPath) ? expandedPath : resolve(ctx.cwd, expandedPath)

    const pending = pendingPaths.get(filePath)
    pendingPaths.delete(filePath)
    if (!pending)
      return

    if (!TS_EXTENSIONS.test(filePath))
      return
    if (!isExistingFile(filePath))
      return

    // Ensure strategy is loaded (may sniff on first call)
    const { strategy } = loadStrategy(ctx.cwd)

    const fixCount = fixCounters.get(filePath) ?? 0
    if (fixCount >= MAX_FIX_ATTEMPTS) {
      log.debug(`[lint-gate] max fix attempts (${MAX_FIX_ATTEMPTS}) reached for ${filePath}`)
      return
    }

    if (strategy === 'eslint') {
      return handleEslintStrategy(pi, filePath, ctx.cwd, fixCount, log)
    }
    return handleOxlintStrategy(pi, filePath, fixCount, log)
  })

  // ── turn_end: clear pending paths only (keep fixCounters to prevent loops) ──
  pi.on('turn_end', async () => {
    pendingPaths.clear()
  })
}

export default oxlintGate
