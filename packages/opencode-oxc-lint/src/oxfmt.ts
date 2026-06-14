import type { NormalizedOptions } from './config'

import type { CommandRunner } from './oxlint'
import { spawnSync } from 'node:child_process'
import { expandHome } from './config'
import { bunCommandRunner } from './oxlint'

export interface FormatResult {
  /** Whether formatting succeeded without errors. */
  formatted: boolean
  /** Whether the file was actually changed. */
  changed: boolean
  /** CLI output. */
  output: string
}

export interface OxfmtDeps {
  runner?: CommandRunner
  /** Override the binary availability check (useful for tests). */
  isAvailable?: (bin: string) => boolean
}

export function buildOxfmtArgs(filePath: string, options: NormalizedOptions): string[] {
  const args: string[] = []

  if (options.oxfmtConfigPath)
    args.push('-c', options.oxfmtConfigPath)

  if (options.oxfmtDisableNestedConfig)
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
 */
export async function runOxfmtForFile(
  filePath: string,
  options: NormalizedOptions,
  deps: OxfmtDeps = {},
): Promise<FormatResult> {
  const runner = deps.runner ?? bunCommandRunner
  const bin = expandHome(options.oxfmtBin) ?? options.oxfmtBin
  const available = deps.isAvailable ? deps.isAvailable(bin) : isOxfmtAvailable(bin)

  if (!available)
    return { formatted: true, changed: false, output: '' }

  const result = await runner(bin, buildOxfmtArgs(filePath, options))
  const exitCode = result.exitCode
  const output = joinOutput(result.stdout, result.stderr)

  // oxfmt exit codes: 0 = formatted (may or may not have changed), 1 = error
  return { formatted: exitCode !== 1, changed: exitCode === 0, output }
}
