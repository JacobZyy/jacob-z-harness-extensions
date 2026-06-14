import type { NormalizedOptions } from './config'

import { describe, expect, it } from 'vitest'
import { buildOxfmtArgs, runOxfmtForFile } from './oxfmt'

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

describe('oxfmt', () => {
  it('builds args with just the file path by default', () => {
    expect(buildOxfmtArgs('/tmp/a.ts', baseOptions)).toEqual(['/tmp/a.ts'])
  })

  it('adds config and nested config flags', () => {
    const options = {
      ...baseOptions,
      oxfmtConfigPath: './.oxfmtrc.json',
      oxfmtDisableNestedConfig: true,
    }

    expect(buildOxfmtArgs('/tmp/a.ts', options)).toEqual([
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
