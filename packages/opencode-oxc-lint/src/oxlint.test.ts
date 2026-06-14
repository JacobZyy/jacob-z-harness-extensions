import type { NormalizedOptions } from './config'

import { describe, expect, it } from 'vitest'
import { buildOxlintArgs, runLintForFile } from './oxlint'

const baseOptions: NormalizedOptions = {
  oxlintBin: 'oxlint',
  configPath: undefined,
  disableNestedConfig: false,
  oxfmtBin: 'oxfmt',
  oxfmtConfigPath: undefined,
  oxfmtDisableNestedConfig: false,
  extensions: ['.ts'],
  maxLines: 2000,
  log: false,
  logPath: 'unused.log',
}

describe('oxlint', () => {
  it('builds fix and check arguments', () => {
    expect(buildOxlintArgs('/tmp/a.ts', baseOptions, true)).toEqual(['--fix', '/tmp/a.ts'])
    expect(buildOxlintArgs('/tmp/a.ts', baseOptions, false)).toEqual(['/tmp/a.ts'])
  })

  it('adds config and nested config flags', () => {
    const options = {
      ...baseOptions,
      configPath: './.oxlintrc.json',
      disableNestedConfig: true,
    }

    expect(buildOxlintArgs('/tmp/a.ts', options, true)).toEqual([
      '-c',
      './.oxlintrc.json',
      '--disable-nested-config',
      '--fix',
      '/tmp/a.ts',
    ])
  })

  it('returns no diagnostics when fix is clean', async () => {
    const result = await runLintForFile('/tmp/a.ts', baseOptions, async () => ({
      exitCode: 0,
      stdout: '',
      stderr: '',
    }))

    expect(result.message).toBeUndefined()
  })

  it('returns final check diagnostics after fix output', async () => {
    const calls: string[][] = []
    const result = await runLintForFile('/tmp/a.ts', baseOptions, async (_bin, args) => {
      calls.push(args)
      if (args.includes('--fix')) {
        return { exitCode: 1, stdout: 'before fix', stderr: '' }
      }
      return { exitCode: 1, stdout: 'final diagnostics', stderr: '' }
    })

    expect(calls).toHaveLength(2)
    expect(result.message).toBe('final diagnostics')
  })
})
