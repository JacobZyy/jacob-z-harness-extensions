import type { AdapterDeps, FormatResult, NormalizedOptions, NormalizedOxfmt } from '../core/types'

import { spawnSync } from 'node:child_process'
import { expandHome } from '../core/config'
import { bunCommandRunner } from '../core/runner'

export interface OxfmtDeps extends AdapterDeps {
  /** Override the binary availability check (useful for tests). */
  isAvailable?: (bin: string) => boolean
}

export function buildOxfmtArgs(filePath: string, oxfmt: NormalizedOxfmt): string[] {
  const args: string[] = []

  if (oxfmt.configPath)
    args.push('-c', oxfmt.configPath)

  if (oxfmt.disableNestedConfig)
    args.push('--disable-nested-config')

  args.push(filePath)
  return args
}

const _oxfmtAvailable = new Map<string, boolean>()

/** Check whether the oxfmt binary is installed (cached per binary). */
export function isOxfmtAvailable(bin: string): boolean {
  const cached = _oxfmtAvailable.get(bin)
  if (cached !== undefined)
    return cached

  const result = spawnSync(bin, ['--version'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 3000,
  })
  const available = !result.error
  _oxfmtAvailable.set(bin, available)
  return available
}

function joinOutput(stdout: string, stderr: string): string {
  return [stdout.trim(), stderr.trim()].filter(Boolean).join('\n')
}

/**
 * Run oxfmt on a single file.
 * Silently skips when the oxfmt binary is not installed.
 *
 * oxfmt is the formatter bound to the oxlint adapter (formatter ↔ linter
 * tied); it reads its config from `options.oxlint.oxfmt`.
 */
export async function runOxfmtForFile(
  filePath: string,
  options: NormalizedOptions,
  deps: OxfmtDeps = {},
): Promise<FormatResult> {
  const runner = deps.runner ?? bunCommandRunner
  const oxfmt = options.oxlint.oxfmt
  const bin = expandHome(oxfmt.bin) ?? oxfmt.bin
  const available = deps.isAvailable ? deps.isAvailable(bin) : isOxfmtAvailable(bin)

  if (!available)
    return { formatted: true, changed: false, output: '' }

  const result = await runner(bin, buildOxfmtArgs(filePath, oxfmt))
  const exitCode = result.exitCode
  const output = joinOutput(result.stdout, result.stderr)

  // oxfmt exit codes: 0 = formatted (may or may not have changed), 1 = error
  return { formatted: exitCode !== 1, changed: exitCode === 0, output }
}
