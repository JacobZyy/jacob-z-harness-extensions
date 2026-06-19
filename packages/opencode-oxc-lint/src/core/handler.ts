import type { OxcLintOptions } from './config'
import type { AdapterDeps, HintState, LinterAdapter, NormalizedOptions } from './types'

import { existsSync } from 'node:fs'
import { extname, isAbsolute, join } from 'node:path'
import { expandHome, normalizeOptions } from './config'
import { hashDiagnostics } from './fingerprint'
import { writeLocalLog } from './log'
import { runPipelineForFile } from './pipeline'
import { extractToolPaths, filterLintableFiles, matchesIgnore } from './resolve'

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

interface HandlerDependencies extends AdapterDeps {
  options?: OxcLintOptions
}

export interface IdleResult {
  ran: boolean
  files: string[]
  diagnostics: string[]
}

export interface ToolAfterResult {
  filesProcessed: number
  filesWithDiagnostics: number
}

const EDIT_TOOLS = new Set(['edit', 'write', 'apply_patch'])

/**
 * Per-file hint state: a diagnostics fingerprint + how many times the same
 * fingerprint has been injected. Replaces the naive counter so that changed
 * (partially-fixed or new) diagnostics reset the counter, while stuck ones
 * still bail out after `maxHints` repetitions.
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
      const options = normalizeOptions({}, ctx.cwd)
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

function resolveOptions(deps: HandlerDependencies, cwd: string): NormalizedOptions {
  const options = normalizeOptions(deps.options, cwd)
  const oxlintBin = expandHome(options.oxlint.bin) ?? options.oxlint.bin
  const configPath = expandHome(options.oxlint.configPath)
  const oxfmtBin = expandHome(options.oxlint.oxfmt.bin) ?? options.oxlint.oxfmt.bin
  const eslintBin = expandHome(options.eslint.bin) ?? options.eslint.bin
  const eslintConfigPath = expandHome(options.eslint.configPath)
  const logPath = expandHome(options.logPath) ?? options.logPath

  return {
    ...options,
    logPath,
    oxlint: {
      ...options.oxlint,
      bin: oxlintBin,
      configPath,
      oxfmt: { ...options.oxlint.oxfmt, bin: oxfmtBin },
    },
    eslint: { ...options.eslint, bin: eslintBin, configPath: eslintConfigPath },
  }
}

function oxlintConfigMissing(options: NormalizedOptions): boolean {
  return options.linter === 'oxlint'
    && options.oxlint.configPath !== undefined
    && !existsSync(options.oxlint.configPath)
}

export async function handleSessionIdle(
  sessionID: string,
  ctx: RuntimeContext,
  collector: FileCollector,
  adapter: LinterAdapter,
  deps: HandlerDependencies = {},
): Promise<IdleResult> {
  const pending = collector.drain(sessionID)
  if (pending.length === 0)
    return { ran: false, files: [], diagnostics: [] }

  const options = resolveOptions(deps, ctx.cwd)

  if (oxlintConfigMissing(options)) {
    if (options.log) {
      writeLocalLog(options.logPath, {
        sessionID,
        action: 'error',
        summary: `Configured oxlint config does not exist: ${options.oxlint.configPath}`,
      })
    }
    return { ran: false, files: [], diagnostics: [] }
  }

  const files = filterLintableFiles(pending, {
    cwd: ctx.cwd,
    extensions: options.extensions,
    maxLines: options.maxLines,
  })

  const diagnostics: string[] = []

  for (const file of files) {
    try {
      const result = await runPipelineForFile(file, options, adapter, {
        runner: deps.runner,
        oxfmtAvailable: deps.oxfmtAvailable,
      })

      if (options.log) {
        writeLocalLog(options.logPath, {
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
      if (options.log) {
        writeLocalLog(options.logPath, {
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
 * Loop prevention is fingerprint-based: each file tracks a diagnostics hash +
 * a count. When the hash is unchanged (LLM can't/won't fix it) the count
 * rises until `maxHints` is reached, after which the same diagnostics are no
 * longer injected. When the hash changes (partial fix / new error) the count
 * resets. When the file goes clean the record is cleared. Behavior of the
 * injected message is governed by `mode` (fix | notify | silent), and files
 * matching any `ignore` glob skip the pipeline entirely.
 */
export async function handleToolAfter(
  input: ToolAfterInput,
  output: ToolAfterOutput,
  ctx: RuntimeContext,
  hintStates: Map<string, Map<string, HintState>>,
  adapter: LinterAdapter,
  deps: HandlerDependencies = {},
): Promise<ToolAfterResult> {
  if (!EDIT_TOOLS.has(input.tool))
    return { filesProcessed: 0, filesWithDiagnostics: 0 }

  const options = resolveOptions(deps, ctx.cwd)

  if (oxlintConfigMissing(options)) {
    if (options.log) {
      writeLocalLog(options.logPath, {
        sessionID: input.sessionID,
        action: 'error',
        summary: `Configured oxlint config does not exist: ${options.oxlint.configPath}`,
      })
    }
    return { filesProcessed: 0, filesWithDiagnostics: 0 }
  }

  const paths = extractToolPaths(input.tool, input.args)
  const files = filterLintableFiles(paths, {
    cwd: ctx.cwd,
    extensions: options.extensions,
    maxLines: options.maxLines,
  })

  let stateMap = hintStates.get(input.sessionID)
  if (!stateMap) {
    stateMap = new Map()
    hintStates.set(input.sessionID, stateMap)
  }

  let filesProcessed = 0
  let filesWithDiagnostics = 0

  for (const file of files) {
    // 1. ignore glob 跳过（不跑 pipeline、不计数、不注入）
    if (matchesIgnore(file, ctx.cwd, options.ignore)) {
      if (options.log) {
        writeLocalLog(options.logPath, {
          sessionID: input.sessionID,
          file,
          action: 'skip',
          summary: 'ignored by glob pattern',
        })
      }
      continue
    }

    try {
      const result = await runPipelineForFile(file, options, adapter, {
        runner: deps.runner,
        oxfmtAvailable: deps.oxfmtAvailable,
      })

      if (options.log) {
        writeLocalLog(options.logPath, {
          sessionID: input.sessionID,
          file,
          action: result.message ? 'check' : 'fix',
          exitCode: result.checkExitCode ?? result.fixExitCode,
          summary: result.message ? 'remaining diagnostics' : 'clean after pipeline',
        })
      }

      // 2. pipeline 跑完即计入 processed
      filesProcessed++

      // 3. clean → 清除指纹记录
      if (!result.message) {
        stateMap.delete(file)
        continue
      }

      // 4. 指纹去重防闭环
      filesWithDiagnostics++
      const fingerprint = hashDiagnostics(result.message)
      const prev = stateMap.get(file)
      if (prev && prev.fingerprint === fingerprint) {
        prev.count++
        if (prev.count > options.maxHints) {
          if (options.log) {
            writeLocalLog(options.logPath, {
              sessionID: input.sessionID,
              file,
              action: 'skip',
              summary: `max hints (${options.maxHints}) reached, same diagnostics`,
            })
          }
          continue
        }
      }
      else {
        // 指纹变了（部分修复/新错误）→ 重置计数
        stateMap.set(file, { fingerprint, count: 1 })
      }

      // 5. 按 mode 决定是否注入 output
      if (options.mode === 'silent')
        continue

      const prefix
        = options.mode === 'notify'
          ? '[oxc-lint: informational, no fix needed]'
          : '[oxc-lint]'
      output.output += `\n\n${prefix} ${file}:\n${result.message}`
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (options.log) {
        writeLocalLog(options.logPath, {
          sessionID: input.sessionID,
          file,
          action: 'error',
          summary: message,
        })
      }
    }
  }

  return { filesProcessed, filesWithDiagnostics }
}
