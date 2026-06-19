import type { NormalizedOptions } from '../../src/core/types'

import { describe, expect, it } from 'vitest'
import { buildOxlintArgs, runOxlintForFile } from '../../src/adapters/oxlint'

const baseOptions: NormalizedOptions = {
  linter: 'oxlint',
  extensions: ['.ts'],
  maxLines: 2000,
  log: false,
  logPath: 'unused.log',
  maxHints: 3,
  mode: 'fix',
  ignore: [],
  oxlint: {
    bin: 'oxlint',
    configPath: undefined,
    disableNestedConfig: false,
    oxfmt: { bin: 'oxfmt', configPath: undefined, disableNestedConfig: false },
  },
  eslint: { bin: 'eslint', configPath: undefined },
}

describe('oxlint adapter', () => {
  it('builds fix and check arguments', () => {
    expect(buildOxlintArgs('/tmp/a.ts', baseOptions.oxlint, true)).toEqual(['--fix', '/tmp/a.ts'])
    expect(buildOxlintArgs('/tmp/a.ts', baseOptions.oxlint, false)).toEqual(['/tmp/a.ts'])
  })

  it('adds config and nested config flags', () => {
    const ox = {
      ...baseOptions.oxlint,
      configPath: './.oxlintrc.json',
      disableNestedConfig: true,
    }

    expect(buildOxlintArgs('/tmp/a.ts', ox, true)).toEqual([
      '-c',
      './.oxlintrc.json',
      '--disable-nested-config',
      '--fix',
      '/tmp/a.ts',
    ])
  })

  it('returns no diagnostics when fix is clean', async () => {
    const result = await runOxlintForFile('/tmp/a.ts', baseOptions, {
      runner: async () => ({ exitCode: 0, stdout: '', stderr: '' }),
    })

    expect(result.message).toBeUndefined()
  })

  it('treats volatile summary-only output as clean (no real diagnostics)', async () => {
    const result = await runOxlintForFile('/tmp/a.ts', baseOptions, {
      runner: async () => ({
        exitCode: 0,
        stdout: 'Found 0 warnings and 0 errors.\nFinished in 3ms on 1 file with 182 rules using 10 threads',
        stderr: '',
      }),
    })

    expect(result.message).toBeUndefined()
  })

  it('returns final check diagnostics after fix output', async () => {
    const calls: string[][] = []
    const result = await runOxlintForFile('/tmp/a.ts', baseOptions, {
      runner: async (_bin, args) => {
        calls.push(args)
        if (args.includes('--fix')) {
          return { exitCode: 1, stdout: 'before fix', stderr: '' }
        }
        return { exitCode: 1, stdout: 'final diagnostics', stderr: '' }
      },
    })

    expect(calls).toHaveLength(2)
    expect(result.message).toBe('final diagnostics')
  })

  it('strips volatile summary lines from the returned message (fingerprint stabilization)', async () => {
    const result = await runOxlintForFile('/tmp/a.ts', baseOptions, {
      runner: async () => ({
        exitCode: 1,
        stdout: 'no-debugger\n  1 | debugger;\nFound 0 warnings and 1 error.\nFinished in 3ms on 1 file',
        stderr: '',
      }),
    })

    expect(result.message).toBeDefined()
    expect(result.message).toContain('no-debugger')
    expect(result.message).not.toContain('Found 0 warnings')
    expect(result.message).not.toContain('Finished in')
  })
})
