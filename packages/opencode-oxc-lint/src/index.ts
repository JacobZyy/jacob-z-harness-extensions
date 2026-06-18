import type { Plugin, PluginOptions } from '@opencode-ai/plugin'
import type { OxcLintOptions } from './config'

import type { CommandRunner } from './oxlint'

import { existsSync } from 'node:fs'
import { extname, isAbsolute, join } from 'node:path'
import { expandHome, normalizeOptions } from './config'
import { writeLocalLog } from './log'
import { runPipelineForFile } from './pipeline'
import { extractToolPaths, filterLintableFiles } from './resolve'

interface ToolAfterInput {
  tool: string
  sessionID: string
  callID: string
  args: Record<string, unknown>
}

interface ToolAfterOutput {
  title: string
  output: string
  metadata: unknown
}

interface RuntimeContext {
  cwd: string
}

interface HandlerDependencies {
  options?: OxcLintOptions
  runner?: CommandRunner
  oxfmtAvailable?: (bin: string) => boolean
}

export interface IdleResult {
  ran: boolean
  files: string[]
  diagnostics: string[]
}

function toOptions(options?: PluginOptions | OxcLintOptions): OxcLintOptions {
  return (options ?? {}) as OxcLintOptions
}

const EDIT_TOOLS = new Set(['edit', 'write', 'apply_patch'])

export interface FileCollector {
  collect: (input: ToolAfterInput, ctx: RuntimeContext) => void
  drain: (sessionID: string) => string[]
}

export function createCollector(): FileCollector {
  const files = new Map<string, Set<string>>()

  return {
    collect(input, ctx) {
      if (!EDIT_TOOLS.has(input.tool))
        return

      const paths = extractToolPaths(input.tool, input.args)
      const options = normalizeOptions()
      for (const path of paths) {
        const absolute = isAbsolute(path) ? path : join(ctx.cwd, path)
        if (!existsSync(absolute))
          continue
        if (!options.extensions.includes(extname(absolute)))
          continue

        let set = files.get(input.sessionID)
        if (!set) {
          set = new Set()
          files.set(input.sessionID, set)
        }
        set.add(absolute)
      }
    },
    drain(sessionID) {
      const set = files.get(sessionID)
      files.delete(sessionID)
      return set ? [...set] : []
    },
  }
}

export async function handleSessionIdle(
  sessionID: string,
  ctx: RuntimeContext,
  collector: FileCollector,
  deps: HandlerDependencies = {},
): Promise<IdleResult> {
  const pending = collector.drain(sessionID)
  if (pending.length === 0)
    return { ran: false, files: [], diagnostics: [] }

  const options = normalizeOptions(deps.options)
  const oxlintBin = expandHome(options.oxlintBin) ?? options.oxlintBin
  const configPath = expandHome(options.configPath)
  const logPath = expandHome(options.logPath) ?? options.logPath
  const resolvedOptions = { ...options, oxlintBin, configPath, logPath }

  if (configPath && !existsSync(configPath)) {
    if (resolvedOptions.log) {
      writeLocalLog(logPath, {
        sessionID,
        action: 'error',
        summary: `Configured oxlint config does not exist: ${configPath}`,
      })
    }
    return { ran: false, files: [], diagnostics: [] }
  }

  const files = filterLintableFiles(pending, {
    cwd: ctx.cwd,
    extensions: resolvedOptions.extensions,
    maxLines: resolvedOptions.maxLines,
  })

  const diagnostics: string[] = []

  for (const file of files) {
    try {
      const result = await runPipelineForFile(file, resolvedOptions, {
        runner: deps.runner,
        oxfmtAvailable: deps.oxfmtAvailable,
      })

      if (resolvedOptions.log) {
        writeLocalLog(logPath, {
          sessionID,
          file,
          action: result.message ? 'check' : 'fix',
          exitCode: result.checkExitCode ?? result.fixExitCode,
          summary: result.message ? 'remaining diagnostics' : 'clean after pipeline',
        })
      }

      if (result.message)
        diagnostics.push(`${file}:\n${result.message}`)
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (resolvedOptions.log) {
        writeLocalLog(logPath, {
          sessionID,
          file,
          action: 'error',
          summary: message,
        })
      }
    }
  }

  return { ran: files.length > 0, files, diagnostics }
}

/**
 * Immediate-mode handler: runs the lint pipeline on files touched by
 * edit/write/apply_patch and injects remaining diagnostics into the tool
 * output so the LLM can see and fix them in the current turn.
 *
 * A per-file-per-session hint counter prevents infinite fix loops: once a
 * file has been hinted `maxHints` times, further diagnostics are silently
 * skipped (logged as `skip`).
 */
export async function handleToolAfter(
  input: ToolAfterInput,
  output: ToolAfterOutput,
  ctx: RuntimeContext,
  hintCounts: Map<string, Map<string, number>>,
  deps: HandlerDependencies = {},
): Promise<void> {
  if (!EDIT_TOOLS.has(input.tool))
    return

  const options = normalizeOptions(deps.options)
  const oxlintBin = expandHome(options.oxlintBin) ?? options.oxlintBin
  const configPath = expandHome(options.configPath)
  const logPath = expandHome(options.logPath) ?? options.logPath
  const resolvedOptions = { ...options, oxlintBin, configPath, logPath }

  if (configPath && !existsSync(configPath)) {
    if (resolvedOptions.log) {
      writeLocalLog(logPath, {
        sessionID: input.sessionID,
        action: 'error',
        summary: `Configured oxlint config does not exist: ${configPath}`,
      })
    }
    return
  }

  const paths = extractToolPaths(input.tool, input.args)
  const files = filterLintableFiles(paths, {
    cwd: ctx.cwd,
    extensions: resolvedOptions.extensions,
    maxLines: resolvedOptions.maxLines,
  })

  let counts = hintCounts.get(input.sessionID)
  if (!counts) {
    counts = new Map()
    hintCounts.set(input.sessionID, counts)
  }

  for (const file of files) {
    const count = counts.get(file) ?? 0
    if (count >= resolvedOptions.maxHints) {
      if (resolvedOptions.log) {
        writeLocalLog(logPath, {
          sessionID: input.sessionID,
          file,
          action: 'skip',
          summary: `max hints (${resolvedOptions.maxHints}) reached, skipping`,
        })
      }
      continue
    }

    try {
      const result = await runPipelineForFile(file, resolvedOptions, {
        runner: deps.runner,
        oxfmtAvailable: deps.oxfmtAvailable,
      })

      if (resolvedOptions.log) {
        writeLocalLog(logPath, {
          sessionID: input.sessionID,
          file,
          action: result.message ? 'check' : 'fix',
          exitCode: result.checkExitCode ?? result.fixExitCode,
          summary: result.message ? 'remaining diagnostics' : 'clean after pipeline',
        })
      }

      if (result.message) {
        counts.set(file, count + 1)
        output.output += `\n\n[oxc-lint] ${file}:\n${result.message}`
      }
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (resolvedOptions.log) {
        writeLocalLog(logPath, {
          sessionID: input.sessionID,
          file,
          action: 'error',
          summary: message,
        })
      }
    }
  }
}

const plugin: Plugin = async (input, options) => {
  const pluginOptions = toOptions(options)
  const normalized = normalizeOptions(pluginOptions)
  const logPath = expandHome(normalized.logPath) ?? normalized.logPath
  const hintCounts = new Map<string, Map<string, number>>()

  if (normalized.log) {
    writeLocalLog(logPath, { action: 'check', summary: 'plugin loaded' })
  }

  return {
    'tool.execute.after': async (hookInput, output) => {
      if (normalized.log && EDIT_TOOLS.has(hookInput.tool)) {
        writeLocalLog(logPath, {
          tool: hookInput.tool,
          action: 'check',
          summary: `collected: ${JSON.stringify(extractToolPaths(hookInput.tool, hookInput.args))}`,
        })
      }
      await handleToolAfter(hookInput, output, { cwd: input.directory }, hintCounts, {
        options: pluginOptions,
      })
    },
  }
}

export default plugin
