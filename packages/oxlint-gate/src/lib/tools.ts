import type { ExtensionAPI, ToolResultEventResult } from '../omp-types'
import type { NormalizedConfig } from './config'
import { truncateOutput, writeLog } from './log'
import { runOxlintCheck, runOxlintFix, shouldIgnoreOxlint } from './oxlint'

export interface ToolContext {
  pi: ExtensionAPI
  filePath: string
  cwd: string
  fixCount: number
  log: ExtensionAPI['logger']
  config: NormalizedConfig
}

/**
 * Run the oxlint pipeline.
 * Checks → auto-fixes → reports remaining issues.
 */
export function runLint(ctx: ToolContext): undefined | ToolResultEventResult {
  const { pi, filePath, log, config } = ctx

  if (shouldIgnoreOxlint(filePath, config))
    return undefined

  const { passed } = runOxlintCheck(filePath, config)
  if (passed) {
    log.info(`[lint-gate] oxlint passed: ${filePath}`)
    writeLog('INFO', `oxlint passed: ${filePath}`)
    return undefined
  }

  log.warn(`[lint-gate] oxlint violations in ${filePath}, attempting auto-fix`)
  writeLog('WARN', `oxlint violations in ${filePath}, attempting auto-fix`)

  const fixResult = runOxlintFix(filePath, config)

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
