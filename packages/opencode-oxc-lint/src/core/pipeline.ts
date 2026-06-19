import type { AdapterDeps, LinterAdapter, NormalizedOptions } from './types'

export interface PipelineDeps extends AdapterDeps {}

export interface PipelineResult {
  file: string
  /** formatter ran without error. */
  formatted: boolean
  /** formatter actually changed the file. */
  changed: boolean
  /** `--fix` exit code. */
  fixExitCode: number
  /** check exit code (only set when a check ran). */
  checkExitCode?: number
  /** remaining diagnostics after fix + check. */
  message?: string
}

/**
 * Run the lint pipeline on a single file through the selected adapter:
 *   1. adapter.format?  (formatter bound to the linter; oxlint → oxfmt)
 *   2. adapter.lint     (--fix then check, returns stabilized diagnostics)
 *
 * The base is linter-agnostic: it just drives the adapter contract.
 */
export async function runPipelineForFile(
  filePath: string,
  options: NormalizedOptions,
  adapter: LinterAdapter,
  deps: PipelineDeps = {},
): Promise<PipelineResult> {
  let formatted = false
  let changed = false

  if (adapter.format) {
    const fmt = await adapter.format(filePath, options, deps)
    formatted = fmt.formatted
    changed = fmt.changed
  }

  const lint = await adapter.lint(filePath, options, deps)

  return {
    file: filePath,
    formatted,
    changed,
    fixExitCode: lint.fixExitCode,
    checkExitCode: lint.checkExitCode,
    message: lint.message,
  }
}
