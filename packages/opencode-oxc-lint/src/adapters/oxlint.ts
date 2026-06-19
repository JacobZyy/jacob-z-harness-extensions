import type {
  AdapterDeps,
  FormatResult,
  LintDiagnostics,
  LinterAdapter,
  NormalizedOptions,
  NormalizedOxlinter,
} from '../core/types'

import { bunCommandRunner } from '../core/runner'
import { runOxfmtForFile } from './oxfmt'

function joinOutput(result: { stdout: string, stderr: string }): string {
  return [result.stdout.trim(), result.stderr.trim()].filter(Boolean).join('\n')
}

/**
 * oxlint output lines that carry no diagnostic meaning — rule counts and
 * timing vary run-to-run. oxlint emits them even when there are zero
 * diagnostics (`Found 0 warnings and 0 errors.` / `Finished in 3ms ...`),
 * so they must not be treated as real diagnostics when deciding whether a
 * file is clean, nor included in the stabilized message used for the
 * fingerprint hash.
 */
export const VOLATILE_TAIL_RE = /^(?:Found \d+ warning|Finished in )/

function hasRealDiagnostics(output: string): boolean {
  return output.split('\n').some(line => line.trim().length > 0 && !VOLATILE_TAIL_RE.test(line))
}

/** Remove volatile summary lines so the fingerprint stays stable across runs. */
function stabilize(message: string): string {
  const kept = message.split('\n').filter(line => !VOLATILE_TAIL_RE.test(line)).join('\n').trim()
  return kept.length > 0 ? kept : message
}

export function buildOxlintArgs(filePath: string, ox: NormalizedOxlinter, fix: boolean): string[] {
  const args: string[] = []

  if (ox.configPath)
    args.push('-c', ox.configPath)

  if (ox.disableNestedConfig)
    args.push('--disable-nested-config')

  if (fix)
    args.push('--fix')

  args.push(filePath)
  return args
}

export async function runOxlintForFile(
  filePath: string,
  options: NormalizedOptions,
  deps: AdapterDeps = {},
): Promise<LintDiagnostics> {
  const runner = deps.runner ?? bunCommandRunner
  const ox = options.oxlint

  const fix = await runner(ox.bin, buildOxlintArgs(filePath, ox, true))
  const fixOutput = joinOutput(fix)

  if (fix.exitCode === 0 && !hasRealDiagnostics(fixOutput)) {
    return { fixExitCode: fix.exitCode }
  }

  const check = await runner(ox.bin, buildOxlintArgs(filePath, ox, false))
  const checkOutput = joinOutput(check)

  // No real diagnostics in either pass (only volatile summary lines) → clean.
  if (!hasRealDiagnostics(checkOutput) && !hasRealDiagnostics(fixOutput)) {
    return { fixExitCode: fix.exitCode, checkExitCode: check.exitCode }
  }

  return {
    message: stabilize(checkOutput || fixOutput),
    fixExitCode: fix.exitCode,
    checkExitCode: check.exitCode,
  }
}

/**
 * oxlint adapter: ships oxfmt as its bound formatter (formatter ↔ linter
 * tied). The `lint` step returns a stabilized message with volatile summary
 * lines stripped, so the core fingerprint hash is stable across runs.
 */
export const oxlintAdapter: LinterAdapter = {
  name: 'oxlint',
  format(filePath: string, options: NormalizedOptions, deps?: AdapterDeps): Promise<FormatResult> {
    return runOxfmtForFile(filePath, options, deps)
  },
  lint(filePath: string, options: NormalizedOptions, deps?: AdapterDeps): Promise<LintDiagnostics> {
    return runOxlintForFile(filePath, options, deps)
  },
}
