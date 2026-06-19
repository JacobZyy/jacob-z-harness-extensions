import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { __test__, DEFAULT_EXTENSIONS, expandHome, normalizeOptions } from '../../src/core/config'

describe('config', () => {
  const tempDirs: string[] = []
  // Isolated HOME so normalizeOptions()'s user-level read does not pick up the
  // developer's real ~/.config/opencode/jacob-z-harness-opencode.json.
  const isolatedHome = join(
    tmpdir(),
    `oxc-config-home-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  )
  let originalHome: string | undefined

  beforeEach(() => {
    mkdirSync(isolatedHome, { recursive: true })
    tempDirs.push(isolatedHome)
    originalHome = process.env.HOME
    process.env.HOME = isolatedHome
  })

  afterEach(() => {
    process.env.HOME = originalHome
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true })
    }
    tempDirs.length = 0
  })

  it('uses generic defaults without personal paths', () => {
    const options = normalizeOptions({}, isolatedHome)

    expect(options.linter).toBe('oxlint')
    expect(options.oxlint.bin).toBe('oxlint')
    expect(options.oxlint.configPath).toBeUndefined()
    expect(options.oxlint.disableNestedConfig).toBe(false)
    expect(options.oxlint.oxfmt.bin).toBe('oxfmt')
    expect(options.oxlint.oxfmt.configPath).toBeUndefined()
    expect(options.oxlint.oxfmt.disableNestedConfig).toBe(false)
    expect(options.eslint.bin).toBe('eslint')
    expect(options.eslint.configPath).toBeUndefined()
    expect(options.extensions).toEqual(DEFAULT_EXTENSIONS)
    expect(options.maxLines).toBe(2000)
    expect(options.log).toBe(true)
    expect(options.logPath).toBe('~/.local/state/opencode-oxc-lint/opencode-oxc-lint.log')
  })

  it('overrides defaults from grouped plugin options', () => {
    const options = normalizeOptions({
      linter: 'eslint',
      oxlint: {
        bin: '~/bin/oxlint',
        configPath: './.oxlintrc.json',
        disableNestedConfig: true,
        oxfmt: { bin: '~/bin/oxfmt', configPath: './.oxfmtrc.json', disableNestedConfig: true },
      },
      eslint: { bin: '~/bin/eslint', configPath: './eslint.config.js' },
      extensions: ['.ts'],
      maxLines: 500,
      log: false,
      logPath: './lint.log',
    }, isolatedHome)

    expect(options.linter).toBe('eslint')
    expect(options.oxlint.bin).toBe('~/bin/oxlint')
    expect(options.oxlint.configPath).toBe('./.oxlintrc.json')
    expect(options.oxlint.disableNestedConfig).toBe(true)
    expect(options.oxlint.oxfmt.bin).toBe('~/bin/oxfmt')
    expect(options.oxlint.oxfmt.configPath).toBe('./.oxfmtrc.json')
    expect(options.oxlint.oxfmt.disableNestedConfig).toBe(true)
    expect(options.eslint.bin).toBe('~/bin/eslint')
    expect(options.eslint.configPath).toBe('./eslint.config.js')
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

  it('reads grouped options from the harness oxc-lint field', () => {
    const home = join(
      tmpdir(),
      `opencode-oxc-lint-config-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    )
    tempDirs.push(home)
    const configDir = join(home, '.config', 'opencode')
    mkdirSync(configDir, { recursive: true })
    const configPath = join(configDir, 'jacob-z-harness-opencode.json')
    writeFileSync(
      configPath,
      JSON.stringify({
        'oxc-lint': {
          linter: 'eslint',
          oxlint: {
            bin: '~/bin/oxlint',
            configPath: '~/.config/oxc/oxlintrc.json',
            disableNestedConfig: true,
            oxfmt: {
              bin: '~/bin/oxfmt',
              configPath: '~/.config/oxc/oxfmtrc.json',
              disableNestedConfig: true,
            },
          },
          eslint: { bin: '~/bin/eslint', configPath: './eslint.config.js' },
          extensions: ['.ts'],
          maxLines: 100,
          log: false,
          logPath: '~/logs/oxc.log',
        },
      }),
    )

    const options = __test__.readHarnessOptions('~/.config/opencode/jacob-z-harness-opencode.json', home)

    expect(options).toEqual({
      linter: 'eslint',
      oxlint: {
        bin: '~/bin/oxlint',
        configPath: '~/.config/oxc/oxlintrc.json',
        disableNestedConfig: true,
        oxfmt: {
          bin: '~/bin/oxfmt',
          configPath: '~/.config/oxc/oxfmtrc.json',
          disableNestedConfig: true,
        },
      },
      eslint: { bin: '~/bin/eslint', configPath: './eslint.config.js' },
      extensions: ['.ts'],
      maxLines: 100,
      log: false,
      logPath: '~/logs/oxc.log',
    })
  })

  it('defaults mode to fix and ignore to empty', () => {
    const options = normalizeOptions({}, isolatedHome)

    expect(options.mode).toBe('fix')
    expect(options.ignore).toEqual([])
  })

  it('overrides mode and ignore from plugin options', () => {
    const options = normalizeOptions({ mode: 'silent', ignore: ['dist/**'] }, isolatedHome)

    expect(options.mode).toBe('silent')
    expect(options.ignore).toEqual(['dist/**'])
  })

  it('merges project-level .jacob-z config and unions ignore arrays', () => {
    const cwd = join(
      tmpdir(),
      `opencode-oxc-lint-proj-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    )
    tempDirs.push(cwd)
    mkdirSync(join(cwd, '.jacob-z'), { recursive: true })
    writeFileSync(
      join(cwd, '.jacob-z', 'jacob-z-harness-opencode.json'),
      JSON.stringify({ 'oxc-lint': { mode: 'notify', ignore: ['dist/**'] } }),
    )

    const options = normalizeOptions({ ignore: ['**/*.test.ts'] }, cwd)

    expect(options.mode).toBe('notify')
    expect(options.ignore).toEqual(expect.arrayContaining(['dist/**', '**/*.test.ts']))
  })

  it('validates linter, mode, ignore and grouped linter fields', () => {
    expect(__test__.isOxcLintOptions({ linter: 'oxlint' })).toBe(true)
    expect(__test__.isOxcLintOptions({ linter: 'eslint' })).toBe(true)
    expect(__test__.isOxcLintOptions({ linter: 'bogus' })).toBe(false)
    expect(__test__.isOxcLintOptions({ mode: 'fix' })).toBe(true)
    expect(__test__.isOxcLintOptions({ mode: 'notify' })).toBe(true)
    expect(__test__.isOxcLintOptions({ mode: 'silent' })).toBe(true)
    expect(__test__.isOxcLintOptions({ mode: 'bogus' })).toBe(false)
    expect(__test__.isOxcLintOptions({ ignore: ['a', 'b'] })).toBe(true)
    expect(__test__.isOxcLintOptions({ ignore: 'x' })).toBe(false)
    expect(__test__.isOxcLintOptions({ ignore: [1] })).toBe(false)
    expect(__test__.isOxcLintOptions({ oxlint: { bin: 'x' } })).toBe(true)
    expect(__test__.isOxcLintOptions({ oxlint: { bin: 1 } })).toBe(false)
    expect(__test__.isOxcLintOptions({ oxlint: { oxfmt: { bin: 'x' } } })).toBe(true)
    expect(__test__.isOxcLintOptions({ oxlint: { oxfmt: { disableNestedConfig: 'yes' } } })).toBe(false)
    expect(__test__.isOxcLintOptions({ eslint: { configPath: 'x' } })).toBe(true)
    expect(__test__.isOxcLintOptions({ eslint: { bin: 1 } })).toBe(false)
  })
})
