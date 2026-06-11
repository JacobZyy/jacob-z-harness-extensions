import type { NormalizedConfig } from './config'
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
export function runOxfmt(filePath: string, config: NormalizedConfig): FormatResult {
  if (!isOxfmtAvailable(config.oxfmtBin)) {
    return { formatted: true, changed: false, output: '' }
  }

  const cfgPath = config.oxfmtConfigPath ?? OXFMT_CFG
  const ignorePatterns = loadIgnorePatterns(cfgPath)
  if (matchesIgnorePattern(filePath, ignorePatterns)) {
    return { formatted: true, changed: false, output: '' }
  }

  const args = buildOxfmtArgs(filePath, config)
  const result = spawnSync(config.oxfmtBin, args, {
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

function buildOxfmtArgs(filePath: string, config: NormalizedConfig): string[] {
  const args: string[] = []

  if (config.oxfmtConfigPath) {
    args.push('-c', config.oxfmtConfigPath)
  }

  if (config.oxfmtDisableNestedConfig) {
    args.push('--disable-nested-config')
  }

  args.push(filePath)
  return args
}

const _oxfmtAvailable = new Map<string, boolean>()

function isOxfmtAvailable(bin: string): boolean {
  const cached = _oxfmtAvailable.get(bin)
  if (cached !== undefined)
    return cached

  const result = spawnSync(bin, ['--version'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 3000,
  })
  const available = !result.error
  _oxfmtAvailable.set(bin, available)
  return available
}
