import type { ExtensionAPI, ToolResultEventResult } from '../omp-types'
import type { LintStrategy, LintStrategyCache } from './strategy'
import { runEslintCheck, runEslintFix } from './eslint'
import { truncateOutput, writeLog } from './log'
import { runOxlintCheck, runOxlintFix, shouldIgnoreOxlint } from './oxlint'
import { loadStrategy } from './strategy'

export { loadStrategy }
export type { LintStrategy, LintStrategyCache }

export interface ToolContext {
  pi: ExtensionAPI
  filePath: string
  cwd: string
  fixCount: number
  log: ExtensionAPI['logger']
}

/**
 * Run the lint pipeline using the project's detected strategy.
 * Checks → auto-fixes → reports remaining issues.
 */
export function runLint(ctx: ToolContext): undefined | ToolResultEventResult {
  const { strategy } = loadStrategy(ctx.cwd)

  if (strategy === 'eslint') {
    return runEslintPipeline(ctx)
  }
  return runOxlintPipeline(ctx)
}

// ── ESLint pipeline ─────────────────────────────────────────────────────

function runEslintPipeline(ctx: ToolContext): undefined | ToolResultEventResult {
  const { pi, filePath, cwd, log } = ctx

  const { passed } = runEslintCheck(filePath, cwd)
  if (passed) {
    log.info(`[lint-gate] eslint passed: ${filePath}`)
    writeLog('INFO', `eslint passed: ${filePath}`)
    return undefined
  }

  log.warn(`[lint-gate] eslint violations in ${filePath}, attempting auto-fix`)
  writeLog('WARN', `eslint violations in ${filePath}, attempting auto-fix`)

  const { fixed, output } = runEslintFix(filePath, cwd)

  if (fixed) {
    log.info(`[lint-gate] eslint auto-fixed: ${filePath}`)
    writeLog('INFO', `eslint auto-fixed: ${filePath}`)
    return {
      content: [{ type: 'text', text: `✅ [lint-gate] eslint auto-fixed ${filePath}` }],
    }
  }

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

// ── Oxlint pipeline ─────────────────────────────────────────────────────

function runOxlintPipeline(ctx: ToolContext): undefined | ToolResultEventResult {
  const { pi, filePath, log } = ctx

  if (shouldIgnoreOxlint(filePath))
    return undefined

  const { passed } = runOxlintCheck(filePath)
  if (passed) {
    log.info(`[lint-gate] oxlint passed: ${filePath}`)
    writeLog('INFO', `oxlint passed: ${filePath}`)
    return undefined
  }

  log.warn(`[lint-gate] oxlint violations in ${filePath}, attempting auto-fix`)
  writeLog('WARN', `oxlint violations in ${filePath}, attempting auto-fix`)

  const fixResult = runOxlintFix(filePath)

  if (fixResult.fixed) {
    log.info(`[lint-gate] oxlint auto-fixed: ${filePath}`)
    writeLog('INFO', `oxlint auto-fixed: ${filePath}`)
    return {
      content: [{ type: 'text', text: `✅ [lint-gate] auto-fixed lint issues in ${filePath}` }],
    }
  }

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
