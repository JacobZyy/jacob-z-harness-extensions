import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { handleToolAfter } from './index'

describe('plugin integration', () => {
  let dir: string

  beforeEach(() => {
    dir = join(tmpdir(), `opencode-oxc-lint-plugin-${Date.now()}-${Math.random().toString(16).slice(2)}`)
    mkdirSync(dir, { recursive: true })
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('appends remaining diagnostics after a write tool', async () => {
    const file = join(dir, 'a.ts')
    writeFileSync(file, 'const a = 1\n')

    const output = { title: '', output: 'Wrote file successfully.', metadata: {} }
    await handleToolAfter(
      {
        tool: 'write',
        sessionID: 'ses_test',
        callID: 'call_test',
        args: { filePath: file },
      },
      output,
      { cwd: dir },
      {
        options: { log: false, oxlintBin: 'oxlint' },
        runner: async (_bin, args) => {
          if (args.includes('--fix'))
            return { exitCode: 1, stdout: 'fix output', stderr: '' }
          return { exitCode: 1, stdout: 'final diagnostics', stderr: '' }
        },
      },
    )

    expect(output.output).toContain('--- opencode-oxc-lint ---')
    expect(output.output).toContain('final diagnostics')
  })

  it('keeps output unchanged when fix makes file clean', async () => {
    const file = join(dir, 'a.ts')
    writeFileSync(file, 'const a = 1\n')

    const output = { title: '', output: 'Wrote file successfully.', metadata: {} }
    await handleToolAfter(
      {
        tool: 'write',
        sessionID: 'ses_test',
        callID: 'call_test',
        args: { filePath: file },
      },
      output,
      { cwd: dir },
      {
        options: { log: false, oxlintBin: 'oxlint' },
        runner: async () => ({ exitCode: 0, stdout: '', stderr: '' }),
      },
    )

    expect(output.output).toBe('Wrote file successfully.')
  })
})
