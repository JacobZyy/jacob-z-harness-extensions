import type { NormalizedOptions } from './config'

export interface CommandResult {
  exitCode: number
  stdout: string
  stderr: string
}

export type CommandRunner = (bin: string, args: string[]) => Promise<CommandResult>

export interface LintRunResult {
  message?: string
  fixExitCode: number
  checkExitCode?: number
}

export function buildOxlintArgs(filePath: string, options: NormalizedOptions, fix: boolean): string[] {
  const args: string[] = []

  if (options.configPath) {
    args.push('-c', options.configPath)
  }

  if (options.disableNestedConfig) {
    args.push('--disable-nested-config')
  }

  if (fix) {
    args.push('--fix')
  }

  args.push(filePath)
  return args
}

export async function bunCommandRunner(bin: string, args: string[]): Promise<CommandResult> {
  const proc = Bun.spawn([bin, ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
  })

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])

  return { exitCode, stdout, stderr }
}

function joinOutput(result: CommandResult): string {
  return [result.stdout.trim(), result.stderr.trim()].filter(Boolean).join('\n')
}

export async function runLintForFile(
  filePath: string,
  options: NormalizedOptions,
  runner: CommandRunner = bunCommandRunner,
): Promise<LintRunResult> {
  const fix = await runner(options.oxlintBin, buildOxlintArgs(filePath, options, true))
  const fixOutput = joinOutput(fix)

  if (fix.exitCode === 0 && fixOutput.length === 0) {
    return { fixExitCode: fix.exitCode }
  }

  const check = await runner(options.oxlintBin, buildOxlintArgs(filePath, options, false))
  const checkOutput = joinOutput(check)

  return {
    message: checkOutput || fixOutput,
    fixExitCode: fix.exitCode,
    checkExitCode: check.exitCode,
  }
}
