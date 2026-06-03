import type { ToolContext } from '../lib/tools'
import type { ToolResultEventResult } from '../omp-types'
import { MAX_FIX_ATTEMPTS, writeLog } from '../lib/log'
import { runLint } from '../lib/tools'

/**
 * Lint phase: run the project's configured linter (eslint or oxlint).
 * Runs after the format phase.
 */
export function runLintPhase(
  ctx: ToolContext,
): undefined | ToolResultEventResult {
  const { filePath, fixCount, log } = ctx

  if (fixCount >= MAX_FIX_ATTEMPTS) {
    log.debug(`[lint-gate] max fix attempts (${MAX_FIX_ATTEMPTS}) reached for ${filePath}`)
    return undefined
  }

  writeLog('INFO', `lint phase checking: ${filePath}`)
  return runLint(ctx)
}
