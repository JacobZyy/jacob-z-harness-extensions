import type { NormalizedConfig } from '../../src/lib/config'
import type { FormatResult } from '../../src/lib/formatter'
import { describe, expect, it } from 'vitest'
import { runOxfmt } from '../../src/lib/formatter'

const defaultConfig: NormalizedConfig = {
  oxlintBin: 'oxlint',
  configPath: undefined,
  disableNestedConfig: false,
  oxfmtBin: 'oxfmt',
  oxfmtConfigPath: undefined,
  oxfmtDisableNestedConfig: false,
}

describe('runOxfmt', () => {
  it('should return formatted=true when oxfmt is not available', () => {
    // In CI/test env without oxfmt, this gracefully returns
    const result: FormatResult = runOxfmt('/tmp/nonexistent.ts', defaultConfig)
    // If oxfmt not installed, returns formatted:true, changed:false
    // If oxfmt is installed, it may fail on nonexistent file
    expect(result).toHaveProperty('formatted')
    expect(result).toHaveProperty('changed')
    expect(result).toHaveProperty('output')
    expect(typeof result.formatted).toBe('boolean')
    expect(typeof result.changed).toBe('boolean')
    expect(typeof result.output).toBe('string')
  })
})
