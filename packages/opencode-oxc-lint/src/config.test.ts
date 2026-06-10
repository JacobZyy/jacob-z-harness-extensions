import { describe, expect, it } from 'vitest'

import { DEFAULT_EXTENSIONS, expandHome, normalizeOptions } from './config'

describe('config', () => {
  it('uses generic defaults without personal paths', () => {
    const options = normalizeOptions()

    expect(options.oxlintBin).toBe('oxlint')
    expect(options.configPath).toBeUndefined()
    expect(options.disableNestedConfig).toBe(false)
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
      extensions: ['.ts'],
      maxLines: 500,
      log: false,
      logPath: './lint.log',
    })

    expect(options.oxlintBin).toBe('~/bin/oxlint')
    expect(options.configPath).toBe('./.oxlintrc.json')
    expect(options.disableNestedConfig).toBe(true)
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
})
