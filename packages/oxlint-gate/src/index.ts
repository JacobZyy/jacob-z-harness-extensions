/**
 * lint-gate: Real-time lint quality gate for OMP.
 *
 * Intercepts Edit/Write tool calls, runs format-then-lint pipeline.
 * Uses oxlint exclusively. Options read from ~/.omp/oxlint-gate.json.
 *
 * Pipeline: oxfmt (format) → oxlint (lint check + auto-fix)
 *
 * Logs:  `~/.omp/logs/lint-gate.log`
 */

import type { ToolContext } from './lib/tools'
import type { ExtensionAPI, ExtensionFactory } from './omp-types'
import { loadConfig } from './lib/config'
import { writeLog } from './lib/log'
import { runFormatPhase } from './phases/format'
import { runLintPhase } from './phases/lint'
import { resolveFromToolCall, resolveFromToolResult } from './phases/resolve-path'

// ── Extension state ─────────────────────────────────────────────────────

const pendingPaths = new Map<string, { toolName: string, timestamp: number }>()
const fixCounters = new Map<string, number>()

// Load config once per process
const config = loadConfig()

// ── Extension factory ───────────────────────────────────────────────────

const lintGate: ExtensionFactory = (pi: ExtensionAPI): void => {
  const log = pi.logger

  log.info('[lint-gate] extension loaded (format + lint)')
  writeLog('INFO', 'extension loaded (format + lint)')

  // ── session_start: log config ───────────────────────────────────────
  pi.on('session_start', async () => {
    log.info(`[lint-gate] oxlint: bin=${config.oxlintBin}, config=${config.configPath ?? '(default)'}, disableNestedConfig=${config.disableNestedConfig} | oxfmt: bin=${config.oxfmtBin}, config=${config.oxfmtConfigPath ?? '(default)'}, disableNestedConfig=${config.oxfmtDisableNestedConfig}`)
  })

  // ── tool_call: record file path, don't block ────────────────────────
  pi.on('tool_call', async (event, ctx) => {
    const resolved = resolveFromToolCall(event, ctx)
    if (!resolved)
      return

    pendingPaths.set(resolved.filePath, { toolName: resolved.toolName, timestamp: Date.now() })
    return undefined
  })

  // ── tool_result: format → lint pipeline ──────────────────────────────
  pi.on('tool_result', async (event, ctx) => {
    const resolved = resolveFromToolResult(event, ctx)
    if (!resolved)
      return

    const { filePath } = resolved

    const pending = pendingPaths.get(filePath)
    pendingPaths.delete(filePath)
    if (!pending)
      return

    const fixCount = fixCounters.get(filePath) ?? 0
    if (fixCount >= 3) {
      log.debug(`[lint-gate] max fix attempts (3) reached for ${filePath}`)
      return
    }
    fixCounters.set(filePath, fixCount + 1)

    // Phase 1: Format (oxfmt)
    const formatResult = runFormatPhase(filePath, log, config)

    // Phase 2: Lint (oxlint)
    const toolCtx: ToolContext = {
      pi,
      filePath,
      cwd: ctx.cwd,
      fixCount,
      log,
      config,
    }
    const lintResult = runLintPhase(toolCtx)

    // If lint passed, clear fix counter
    if (!lintResult)
      fixCounters.delete(filePath)

    // Return the first non-undefined result (format or lint)
    return formatResult ?? lintResult
  })

  // ── turn_end: clear pending paths only (keep fixCounters to prevent loops) ──
  pi.on('turn_end', async () => {
    pendingPaths.clear()
  })
}

export default lintGate
export { extractFilePath } from './lib/utils'
