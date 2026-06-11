import type { NormalizedConfig } from '../../src/lib/config'
import { describe, expect, it, vi } from 'vitest'
import { runFormatPhase } from '../../src/phases/format'

const defaultConfig: NormalizedConfig = {
  oxlintBin: 'oxlint',
  configPath: undefined,
  disableNestedConfig: false,
  oxfmtBin: 'oxfmt',
  oxfmtConfigPath: undefined,
  oxfmtDisableNestedConfig: false,
}

function makeMockLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }
}

describe('runFormatPhase', () => {
  it('should return undefined for unformatted clean file (no oxfmt or no changes)', () => {
    const log = makeMockLogger()
    const result = runFormatPhase('/tmp/nonexistent.ts', log as any, defaultConfig)
    // Without oxfmt, or with a nonexistent file, returns undefined
    expect(result).toBeUndefined()
  })

  it('should not throw on any input', () => {
    const log = makeMockLogger()
    expect(() => runFormatPhase('/tmp/any-file.ts', log as any, defaultConfig)).not.toThrow()
  })
})
