import { appendFileSync, existsSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const TS_EXTENSIONS = /\.(?:ts|tsx|mts|cts|vue)$/

export const OXLINT_CFG = join(homedir(), '.config', 'oxlint', 'oxlintrc.json')
export const OXFMT_CFG = join(homedir(), '.config', 'oxlint', 'oxfmt.json')

export const LOG_DIR = join(homedir(), '.omp', 'logs')
export const LOG_FILE = join(LOG_DIR, 'lint-gate.log')

/** Tools that modify files */
export const WRITE_TOOLS = new Set(['edit', 'write'])

/** Max auto-fix attempts per file per turn. */
export const MAX_FIX_ATTEMPTS = 3

/** Max lines of lint output to keep. */
export const MAX_OUTPUT_LINES = 20

const HOME = homedir()

export { HOME }

// ── Logger ──────────────────────────────────────────────────────────────

function ensureLogDir(): void {
  if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true })
  }
}

export function writeLog(level: 'INFO' | 'WARN' | 'DEBUG', msg: string): void {
  try {
    ensureLogDir()
    const ts = new Date().toISOString()
    appendFileSync(LOG_FILE, `[${ts}] [${level}] ${msg}\n`)
  }
  catch {
    // Silently ignore log write failures
  }
}

export function truncateOutput(output: string, maxLines: number = MAX_OUTPUT_LINES): string {
  const lines = output.split('\n')
  if (lines.length <= maxLines)
    return output
  const head = lines.slice(0, 10).join('\n')
  const summary = lines.slice(-5).join('\n')
  return `${head}\n\n... (${lines.length - 15} lines truncated) ...\n\n${summary}`
}
