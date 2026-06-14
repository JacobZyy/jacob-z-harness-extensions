import type { NormalizedOptions } from './config'
import type { CommandRunner } from './oxlint'
import { runOxfmtForFile } from './oxfmt'
import { runLintForFile } from './oxlint'

export interface PipelineDeps {
  runner?: CommandRunner
  /** Override the oxfmt binary availability check (useful for tests). */
  oxfmtAvailable?: (bin: string) => boolean
}

export interface PipelineResult {
  file: string
  /** oxfmt ran without error. */
  oxfmtFormatted: boolean
  /** oxfmt actually changed the file. */
  oxfmtChanged: boolean
  /** oxlint --fix exit code. */
  fixExitCode: number
  /** oxlint check exit code (only set when a check ran). */
  checkExitCode?: number
  /** Remaining diagnostics after fix + check. */
  message?: string
}

/**
 * Run the full lint pipeline on a single file, in order:
 *   1. oxfmt  (format)
 *   2. oxlint --fix  (auto-fix)
 *   3. oxlint  (check remaining)
 */
export async function runPipelineForFile(
  filePath: string,
  options: NormalizedOptions,
  deps: PipelineDeps = {},
): Promise<PipelineResult> {
  const fmt = await runOxfmtForFile(filePath, options, {
    runner: deps.runner,
    isAvailable: deps.oxfmtAvailable,
  })

  const lint = await runLintForFile(filePath, options, deps.runner)

  return {
    file: filePath,
    oxfmtFormatted: fmt.formatted,
    oxfmtChanged: fmt.changed,
    fixExitCode: lint.fixExitCode,
    checkExitCode: lint.checkExitCode,
    message: lint.message,
  }
}
