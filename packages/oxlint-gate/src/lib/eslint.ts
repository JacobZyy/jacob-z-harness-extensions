import type { LintCheckResult, LintFixResult } from './types'
import { spawnSync } from 'node:child_process'

/**
 * Run eslint check on a file.
 */
export function runEslintCheck(filePath: string, cwd: string): LintCheckResult {
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

/**
 * Run eslint --fix on a file.
 */
export function runEslintFix(filePath: string, cwd: string): LintFixResult {
  const result = spawnSync('npx', ['eslint', '--fix', filePath], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 15000,
    cwd,
  })

  if (result.error)
    return { fixed: false, remaining: -1, output: `eslint error: ${result.error.message}` }

  const exitCode = result.status ?? -1
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim()
  // eslint: 0 = clean, 1 = lint errors remain, 2 = fatal
  return { fixed: exitCode === 0, remaining: exitCode === 1 ? 1 : 0, output }
}
