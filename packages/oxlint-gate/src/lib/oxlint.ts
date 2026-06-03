import type { LintCheckResult, LintFixResult } from './types'
import { spawnSync } from 'node:child_process'
import { OXLINT_CFG } from './log'
import { loadIgnorePatterns, matchesIgnorePattern } from './utils'

export type { LintCheckResult, LintFixResult }

/**
 * Run oxlint check on a file.
 */
export function runOxlintCheck(filePath: string): LintCheckResult {
  const result = spawnSync('oxlint', ['-c', OXLINT_CFG, filePath], {
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

/**
 * Run oxlint --fix on a file.
 */
export function runOxlintFix(filePath: string): LintFixResult {
  const result = spawnSync('oxlint', ['--fix', '-c', OXLINT_CFG, filePath], {
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

/**
 * Check if file should be ignored by oxlint.
 */
export function shouldIgnoreOxlint(filePath: string): boolean {
  const patterns = loadIgnorePatterns(OXLINT_CFG)
  return matchesIgnorePattern(filePath, patterns)
}
