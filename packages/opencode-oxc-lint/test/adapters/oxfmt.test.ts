import type { NormalizedOptions } from '../../src/core/types'

import { describe, expect, it } from 'vitest'
import { buildOxfmtArgs, runOxfmtForFile } from '../../src/adapters/oxfmt'

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

describe('oxfmt', () => {
  it('builds args with just the file path by default', () => {
    expect(buildOxfmtArgs('/tmp/a.ts', baseOptions.oxlint.oxfmt)).toEqual(['/tmp/a.ts'])
  })

  it('adds config and nested config flags', () => {
    const oxfmt = { bin: 'oxfmt', configPath: './.oxfmtrc.json', disableNestedConfig: true }

    expect(buildOxfmtArgs('/tmp/a.ts', oxfmt)).toEqual([
      '-c',
      './.oxfmtrc.json',
      '--disable-nested-config',
      '/tmp/a.ts',
    ])
  })

  it('skips silently when the binary is unavailable', async () => {
    const result = await runOxfmtForFile('/tmp/a.ts', baseOptions, {
      isAvailable: () => false,
      runner: async () => ({ exitCode: 0, stdout: '', stderr: '' }),
    })

    expect(result).toEqual({ formatted: true, changed: false, output: '' })
  })

  it('reports a change on exit 0', async () => {
    const result = await runOxfmtForFile('/tmp/a.ts', baseOptions, {
      isAvailable: () => true,
      runner: async () => ({ exitCode: 0, stdout: 'formatted', stderr: '' }),
    })

    expect(result.formatted).toBe(true)
    expect(result.changed).toBe(true)
    expect(result.output).toBe('formatted')
  })

  it('reports a formatting failure on exit 1', async () => {
    const result = await runOxfmtForFile('/tmp/a.ts', baseOptions, {
      isAvailable: () => true,
      runner: async () => ({ exitCode: 1, stdout: '', stderr: 'parse error' }),
    })

    expect(result.formatted).toBe(false)
    expect(result.changed).toBe(false)
    expect(result.output).toBe('parse error')
  })
})
