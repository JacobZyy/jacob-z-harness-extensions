import type { NormalizedConfig } from './config'
import type { LintCheckResult, LintFixResult } from './types'
import { spawnSync } from 'node:child_process'
import { OXLINT_CFG } from './log'
import { loadIgnorePatterns, matchesIgnorePattern } from './utils'

export type { LintCheckResult, LintFixResult }

function buildArgs(filePath: string, config: NormalizedConfig, fix: boolean): string[] {
  const args: string[] = []

  if (config.configPath) {
    args.push('-c', config.configPath)
  }

  if (config.disableNestedConfig) {
    args.push('--disable-nested-config')
  }

  if (fix) {
    args.push('--fix')
  }

  args.push(filePath)
  return args
}

/**
 * Run oxlint check on a file.
 */
export function runOxlintCheck(filePath: string, config: NormalizedConfig): LintCheckResult {
  const result = spawnSync(config.oxlintBin, buildArgs(filePath, config, false), {
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
export function runOxlintFix(filePath: string, config: NormalizedConfig): LintFixResult {
  const result = spawnSync(config.oxlintBin, buildArgs(filePath, config, true), {
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
 * Uses config.configPath if set, otherwise falls back to OXLINT_CFG.
 */
export function shouldIgnoreOxlint(filePath: string, config: NormalizedConfig): boolean {
  const cfgPath = config.configPath ?? OXLINT_CFG
  const patterns = loadIgnorePatterns(cfgPath)
  return matchesIgnorePattern(filePath, patterns)
}
