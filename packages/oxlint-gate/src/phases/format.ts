import type { NormalizedConfig } from '../lib/config'
import type { FormatResult } from '../lib/formatter'
import type { ExtensionAPI, ToolResultEventResult } from '../omp-types'
import { runOxfmt } from '../lib/formatter'
import { writeLog } from '../lib/log'

/**
 * Format phase: run oxfmt on the file.
 * Always runs before lint.
 */
export function runFormatPhase(
  filePath: string,
  log: ExtensionAPI['logger'],
  config: NormalizedConfig,
): undefined | ToolResultEventResult {
  const result: FormatResult = runOxfmt(filePath, config)

  if (!result.formatted) {
    log.warn(`[lint-gate] oxfmt failed for ${filePath}: ${result.output}`)
    writeLog('WARN', `oxfmt failed for ${filePath}: ${result.output}`)
    return undefined
  }

  if (result.changed) {
    log.info(`[lint-gate] oxfmt formatted: ${filePath}`)
    writeLog('INFO', `oxfmt formatted: ${filePath}`)
    return {
      content: [{ type: 'text', text: `✅ [lint-gate] oxfmt formatted ${filePath}` }],
    }
  }

  return undefined
}
