import type { CommandResult } from './types'
import process from 'node:process'

/**
 * Default command runner built on the Bun runtime that opencode ships with.
 * Adapters receive a `runner` via `AdapterDeps` so tests can stub it.
 *
 * An optional `env` is merged over the parent process env so adapters can
 * inject linter-specific variables (e.g. eslint's NLAB_AI_HOOK) without losing
 * PATH et al.
 */
export async function bunCommandRunner(
  bin: string,
  args: string[],
  env?: Record<string, string>,
): Promise<CommandResult> {
  const proc = Bun.spawn([bin, ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
    env: env ? { ...process.env, ...env } : undefined,
  })

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])

  return { exitCode, stdout, stderr }
}
