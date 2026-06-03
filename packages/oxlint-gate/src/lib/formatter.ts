import { spawnSync } from 'node:child_process'
import { OXFMT_CFG } from './log'
import { loadIgnorePatterns, matchesIgnorePattern } from './utils'

export interface FormatResult {
  /** Whether formatting succeeded without errors. */
  formatted: boolean
  /** Whether the file was actually changed. */
  changed: boolean
  /** CLI output. */
  output: string
}

/**
 * Run oxfmt on a file.
 * Returns whether the file was formatted and whether it changed.
 */
export function runOxfmt(filePath: string): FormatResult {
  if (!isOxfmtAvailable()) {
    return { formatted: true, changed: false, output: '' }
  }

  const ignorePatterns = loadIgnorePatterns(OXFMT_CFG)
  if (matchesIgnorePattern(filePath, ignorePatterns)) {
    return { formatted: true, changed: false, output: '' }
  }

  const result = spawnSync('oxfmt', [filePath], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 5000,
  })

  if (result.error) {
    return { formatted: true, changed: false, output: `oxfmt error: ${result.error.message}` }
  }

  const exitCode = result.status ?? -1
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim()
  // oxfmt exit codes: 0 = formatted (may or may not have changed), 1 = error
  return { formatted: exitCode !== 1, changed: exitCode === 0, output }
}

let _oxfmtAvailable: boolean | null = null

function isOxfmtAvailable(): boolean {
  if (_oxfmtAvailable !== null)
    return _oxfmtAvailable

  const result = spawnSync('oxfmt', ['--version'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 3000,
  })
  _oxfmtAvailable = !result.error
  return _oxfmtAvailable
}
