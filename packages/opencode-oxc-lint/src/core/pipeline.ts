import type { AdapterDeps, LinterAdapter, NormalizedOptions } from './types'

import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { createPatch } from 'diff'

export interface PipelineDeps extends AdapterDeps {}

export interface PipelineResult {
  file: string
  /** formatter ran without error. */
  formatted: boolean
  /** formatter actually changed the file. */
  changed: boolean
  /** unified diff of formatter changes (only when `changed` is true). */
  formatDiff?: string
  /** `--fix` exit code. */
  fixExitCode: number
  /** check exit code (only set when a check ran). */
  checkExitCode?: number
  /** remaining diagnostics after fix + check. */
  message?: string
}

/**
 * Generate a concise unified diff from before/after file content.
 * Strips the `Index:` / `===` header so the output starts directly with `--- / +++`.
 */
function makeFormatDiff(filePath: string, before: string, after: string): string {
  const name = basename(filePath)
  const patch = createPatch(name, before, after, 'before oxfmt', 'after oxfmt', { context: 3 })
  const lines = patch.split('\n').slice(2).join('\n')
  return lines.trim()
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
  let formatDiff: string | undefined

  if (adapter.format) {
    let before: string | undefined
    try {
      before = readFileSync(filePath, 'utf8')
    }
    catch {
      // file may not exist before format (edge case)
    }

    const fmt = await adapter.format(filePath, options, deps)
    formatted = fmt.formatted
    changed = fmt.changed

    if (changed && before !== undefined) {
      try {
        const after = readFileSync(filePath, 'utf8')
        if (before !== after)
          formatDiff = makeFormatDiff(filePath, before, after)
      }
      catch {
        // file removed after format — nothing to diff
      }
    }
  }

  const lint = await adapter.lint(filePath, options, deps)

  return {
    file: filePath,
    formatted,
    changed,
    formatDiff,
    fixExitCode: lint.fixExitCode,
    checkExitCode: lint.checkExitCode,
    message: lint.message,
  }
}
