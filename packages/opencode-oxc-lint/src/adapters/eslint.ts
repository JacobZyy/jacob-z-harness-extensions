import type {
  AdapterDeps,
  LintDiagnostics,
  LinterAdapter,
  NormalizedEslinter,
  NormalizedOptions,
} from '../core/types'

import { bunCommandRunner } from '../core/runner'

/** Env injected into every eslint invocation. */
const ESLINT_ENV: Record<string, string> = { NLAB_AI_HOOK: 'true' }

function joinOutput(result: { stdout: string, stderr: string }): string {
  return [result.stdout.trim(), result.stderr.trim()].filter(Boolean).join('\n')
}

/**
 * Build eslint CLI args.
 *
 * eslint exit codes: 0 = no problems, 1 = problems found, 2 = config/fatal
 * error. We treat 0 as clean and otherwise surface the check output. Flat
 * config (`eslint.config.js`) is auto-discovered; an explicit `configPath` is
 * forwarded as `-c` for legacy eslintrc usage.
 */
export function buildEslintArgs(filePath: string, es: NormalizedEslinter, fix: boolean): string[] {
  const args: string[] = []

  if (es.configPath)
    args.push('-c', es.configPath)

  if (fix)
    args.push('--fix')

  args.push(filePath)
  return args
}

export async function runEslintForFile(
  filePath: string,
  options: NormalizedOptions,
  deps: AdapterDeps = {},
): Promise<LintDiagnostics> {
  const runner = deps.runner ?? bunCommandRunner
  const es = options.eslint

  const fix = await runner(es.bin, buildEslintArgs(filePath, es, true), ESLINT_ENV)

  // exit 0 ⇒ clean after fix (eslint reports no problems).
  if (fix.exitCode === 0) {
    return { fixExitCode: fix.exitCode }
  }

  const check = await runner(es.bin, buildEslintArgs(filePath, es, false), ESLINT_ENV)
  const checkOutput = joinOutput(check)
  const fixOutput = joinOutput(fix)

  // No readable diagnostics in either pass → treat as clean.
  if (!checkOutput && !fixOutput) {
    return { fixExitCode: fix.exitCode, checkExitCode: check.exitCode }
  }

  return {
    message: checkOutput || fixOutput,
    fixExitCode: fix.exitCode,
    checkExitCode: check.exitCode,
  }
}

/**
 * eslint adapter: no bound formatter (formatter ↔ linter tied — only oxlint
 * ships oxfmt). The `lint` step runs `--fix` then a check pass and surfaces
 * the remaining diagnostics.
 */
export const eslintAdapter: LinterAdapter = {
  name: 'eslint',
  lint(filePath: string, options: NormalizedOptions, deps?: AdapterDeps): Promise<LintDiagnostics> {
    return runEslintForFile(filePath, options, deps)
  },
}
