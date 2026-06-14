import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { __test__, DEFAULT_EXTENSIONS, expandHome, normalizeOptions } from './config'

describe('config', () => {
  const tempDirs: string[] = []

  afterEach(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true })
    }
    tempDirs.length = 0
  })

  it('uses generic defaults without personal paths', () => {
    const options = normalizeOptions()

    expect(options.oxlintBin).toBe('oxlint')
    expect(options.configPath).toBeUndefined()
    expect(options.disableNestedConfig).toBe(false)
    expect(options.oxfmtBin).toBe('oxfmt')
    expect(options.oxfmtConfigPath).toBeUndefined()
    expect(options.oxfmtDisableNestedConfig).toBe(false)
    expect(options.extensions).toEqual(DEFAULT_EXTENSIONS)
    expect(options.maxLines).toBe(2000)
    expect(options.log).toBe(true)
    expect(options.logPath).toBe('~/.local/state/opencode-oxc-lint/opencode-oxc-lint.log')
  })

  it('overrides defaults from plugin options', () => {
    const options = normalizeOptions({
      oxlintBin: '~/bin/oxlint',
      configPath: './.oxlintrc.json',
      disableNestedConfig: true,
      oxfmtBin: '~/bin/oxfmt',
      oxfmtConfigPath: './.oxfmtrc.json',
      oxfmtDisableNestedConfig: true,
      extensions: ['.ts'],
      maxLines: 500,
      log: false,
      logPath: './lint.log',
    })

    expect(options.oxlintBin).toBe('~/bin/oxlint')
    expect(options.configPath).toBe('./.oxlintrc.json')
    expect(options.disableNestedConfig).toBe(true)
    expect(options.oxfmtBin).toBe('~/bin/oxfmt')
    expect(options.oxfmtConfigPath).toBe('./.oxfmtrc.json')
    expect(options.oxfmtDisableNestedConfig).toBe(true)
    expect(options.extensions).toEqual(['.ts'])
    expect(options.maxLines).toBe(500)
    expect(options.log).toBe(false)
    expect(options.logPath).toBe('./lint.log')
  })

  it('expands a leading home marker only', () => {
    const home = '/tmp/home'

    expect(expandHome('~/bin/oxlint', home)).toBe('/tmp/home/bin/oxlint')
    expect(expandHome('project/~/file', home)).toBe('project/~/file')
    expect(expandHome(undefined, home)).toBeUndefined()
  })

  it('reads defaults from the harness oxc-lint field', () => {
    const home = join(tmpdir(), `opencode-oxc-lint-config-${Date.now()}-${Math.random().toString(16).slice(2)}`)
    tempDirs.push(home)
    const configDir = join(home, '.config', 'opencode')
    mkdirSync(configDir, { recursive: true })
    const configPath = join(configDir, 'jacob-z-harness-opencode.json')
    writeFileSync(
      configPath,
      JSON.stringify({
        'oxc-lint': {
          configPath: '~/.config/oxc/oxlintrc.json',
          disableNestedConfig: true,
          oxfmtBin: '~/bin/oxfmt',
          oxfmtConfigPath: '~/.config/oxc/oxfmtrc.json',
          oxfmtDisableNestedConfig: true,
          extensions: ['.ts'],
          maxLines: 100,
          log: false,
          logPath: '~/logs/oxc.log',
          oxlintBin: '~/bin/oxlint',
        },
      }),
    )

    const options = __test__.readHarnessOptions('~/.config/opencode/jacob-z-harness-opencode.json', home)

    expect(options).toEqual({
      configPath: '~/.config/oxc/oxlintrc.json',
      disableNestedConfig: true,
      oxfmtBin: '~/bin/oxfmt',
      oxfmtConfigPath: '~/.config/oxc/oxfmtrc.json',
      oxfmtDisableNestedConfig: true,
      extensions: ['.ts'],
      maxLines: 100,
      log: false,
      logPath: '~/logs/oxc.log',
      oxlintBin: '~/bin/oxlint',
    })
  })
})
