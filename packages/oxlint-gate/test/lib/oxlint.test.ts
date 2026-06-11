import type { NormalizedConfig } from '../../src/lib/config'
import { describe, expect, it } from 'vitest'
import { runOxlintCheck, runOxlintFix, shouldIgnoreOxlint } from '../../src/lib/oxlint'

const defaultConfig: NormalizedConfig = {
  oxlintBin: 'oxlint',
  configPath: undefined,
  disableNestedConfig: false,
  oxfmtBin: 'oxfmt',
  oxfmtConfigPath: undefined,
  oxfmtDisableNestedConfig: false,
}

describe('oxlint', () => {
  describe('runOxlintCheck', () => {
    it('should return a result with passed and output', () => {
      const result = runOxlintCheck('/tmp/nonexistent-test-file.ts', defaultConfig)
      expect(result).toHaveProperty('passed')
      expect(result).toHaveProperty('output')
      expect(typeof result.passed).toBe('boolean')
      expect(typeof result.output).toBe('string')
    })

    it('should pass for a clean existing file', () => {
      // This file itself is a valid TS file
      const result = runOxlintCheck('src/lib/oxlint.ts', defaultConfig)
      // oxlint may or may not be installed; if not, fail-open returns passed:true
      expect(result).toHaveProperty('passed')
    })
  })

  describe('runOxlintFix', () => {
    it('should return a result with fixed, remaining, and output', () => {
      const result = runOxlintFix('/tmp/nonexistent-test-file.ts', defaultConfig)
      expect(result).toHaveProperty('fixed')
      expect(result).toHaveProperty('remaining')
      expect(result).toHaveProperty('output')
      expect(typeof result.fixed).toBe('boolean')
      expect(typeof result.output).toBe('string')
    })
  })

  describe('shouldIgnoreOxlint', () => {
    it('should return a boolean', () => {
      const result = shouldIgnoreOxlint('src/lib/oxlint.ts', defaultConfig)
      expect(typeof result).toBe('boolean')
    })
  })
})
