import type { Plugin, PluginOptions } from '@opencode-ai/plugin'

import type { OxcLintOptions } from './config'

import type { CommandRunner } from './oxlint'
import { existsSync } from 'node:fs'
import { expandHome, normalizeOptions } from './config'
import { writeLocalLog } from './log'
import { appendAgentOutput } from './output'
import { runLintForFile } from './oxlint'
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
}

function toOptions(options?: PluginOptions | OxcLintOptions): OxcLintOptions {
  return (options ?? {}) as OxcLintOptions
}

function appendError(output: ToolAfterOutput, message: string): void {
  output.output = appendAgentOutput(output.output, message)
}

export async function handleToolAfter(
  input: ToolAfterInput,
  output: ToolAfterOutput,
  ctx: RuntimeContext,
  deps: HandlerDependencies = {},
): Promise<void> {
  if (!['edit', 'write', 'apply_patch'].includes(input.tool))
    return

  const options = normalizeOptions(deps.options)
  const oxlintBin = expandHome(options.oxlintBin) ?? options.oxlintBin
  const configPath = expandHome(options.configPath)
  const logPath = expandHome(options.logPath) ?? options.logPath
  const resolvedOptions = { ...options, oxlintBin, configPath, logPath }

  if (configPath && !existsSync(configPath)) {
    const message = `Configured oxlint config does not exist: ${configPath}`
    appendError(output, message)
    if (resolvedOptions.log)
      writeLocalLog(logPath, { sessionID: input.sessionID, tool: input.tool, action: 'error', summary: message })
    return
  }

  const paths = extractToolPaths(input.tool, input.args)
  const files = filterLintableFiles(paths, {
    cwd: ctx.cwd,
    extensions: resolvedOptions.extensions,
    maxLines: resolvedOptions.maxLines,
  })

  for (const file of files) {
    try {
      const result = await runLintForFile(file, resolvedOptions, deps.runner)
      if (resolvedOptions.log) {
        writeLocalLog(logPath, {
          sessionID: input.sessionID,
          tool: input.tool,
          file,
          action: result.message ? 'check' : 'fix',
          exitCode: result.checkExitCode ?? result.fixExitCode,
          summary: result.message ? 'remaining diagnostics' : 'clean after fix',
        })
      }

      if (result.message)
        output.output = appendAgentOutput(output.output, result.message)
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      appendError(output, message)
      if (resolvedOptions.log) {
        writeLocalLog(logPath, {
          sessionID: input.sessionID,
          tool: input.tool,
          file,
          action: 'error',
          summary: message,
        })
      }
      return
    }
  }
}

const plugin: Plugin = async (input, options) => {
  return {
    'tool.execute.after': async function (hookInput, output) {
      await handleToolAfter(hookInput, output, { cwd: input.directory }, { options: toOptions(options) })
    },
  }
}

export default plugin
