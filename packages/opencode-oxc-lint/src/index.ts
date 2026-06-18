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

interface RuntimeContext {
  cwd: string
}

interface HandlerDependencies {
  options?: OxcLintOptions
  runner?: CommandRunner
  /** Override the oxfmt binary availability check (useful for tests). */
  oxfmtAvailable?: (bin: string) => boolean
}

export interface IdleResult {
  /** Whether the pipeline actually ran on at least one file. */
  ran: boolean
  /** Files processed by the pipeline. */
  files: string[]
  /** Remaining diagnostics per file (only when non-empty). */
  diagnostics: string[]
}

function toOptions(options?: PluginOptions | OxcLintOptions): OxcLintOptions {
  return (options ?? {}) as OxcLintOptions
}

const EDIT_TOOLS = new Set(['edit', 'write', 'apply_patch'])

/**
 * Per-session changed-file collector.
 *
 * Files are gathered during `tool.execute.after` (edit/write/apply_patch) and
 * drained once when the session goes idle, so the lint pipeline runs a single
 * batched pass at the end of the turn instead of after every single edit.
 */
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

/**
 * Run the lint pipeline (oxfmt → oxlint --fix → oxlint) on every file collected
 * for the given session, then drain the collector.
 */
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

interface SessionIdleEvent {
  type: 'session.idle'
  properties: { sessionID: string }
}

function isSessionIdleEvent(event: { type: string }): event is SessionIdleEvent {
  return event.type === 'session.idle'
}

const plugin: Plugin = async (input, options) => {
  const collector = createCollector()
  const pluginOptions = toOptions(options)
  const normalized = normalizeOptions(pluginOptions)
  const logPath = expandHome(normalized.logPath) ?? normalized.logPath

  if (normalized.log) {
    writeLocalLog(logPath, { action: 'check', summary: 'plugin loaded' })
  }

  return {
    'tool.execute.after': async (hookInput) => {
      collector.collect(hookInput, { cwd: input.directory })
      if (normalized.log && EDIT_TOOLS.has(hookInput.tool)) {
        writeLocalLog(logPath, {
          tool: hookInput.tool,
          action: 'check',
          summary: `collected: ${JSON.stringify(extractToolPaths(hookInput.tool, hookInput.args))}`,
        })
      }
    },
    'event': async ({ event }) => {
      if (!isSessionIdleEvent(event))
        return

      if (normalized.log) {
        writeLocalLog(logPath, { action: 'check', summary: `event received: ${event.type}` })
      }

      const sessionID = event.properties.sessionID
      const result = await handleSessionIdle(sessionID, { cwd: input.directory }, collector, {
        options: pluginOptions,
      })

      if (result.diagnostics.length > 0) {
        try {
          await input.client.tui.showToast({
            body: {
              title: 'oxc-lint',
              message: `${result.diagnostics.length} file(s) with remaining lint issues`,
              variant: 'warning',
            },
          })
        }
        catch {
          // TUI may be unavailable in headless mode — ignore.
        }
      }
    },
  }
}

export default plugin
