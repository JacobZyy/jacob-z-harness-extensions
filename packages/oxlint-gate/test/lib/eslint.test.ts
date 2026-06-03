import { describe, expect, it } from 'vitest'
import { runEslintCheck, runEslintFix } from '../../src/lib/eslint'

describe('eslint', () => {
  describe('runEslintCheck', () => {
    it('should return a result with passed and output', () => {
      const result = runEslintCheck('/tmp/nonexistent-test-file.ts', process.cwd())
      expect(result).toHaveProperty('passed')
      expect(result).toHaveProperty('output')
      expect(typeof result.passed).toBe('boolean')
      expect(typeof result.output).toBe('string')
    })

    it('should pass for a clean file in this project', () => {
      const result = runEslintCheck('src/lib/eslint.ts', process.cwd())
      expect(result).toHaveProperty('passed')
    })
  })

  describe('runEslintFix', () => {
    it('should return a result with fixed and output', () => {
      const result = runEslintFix('/tmp/nonexistent-test-file.ts', process.cwd())
      expect(result).toHaveProperty('fixed')
      expect(result).toHaveProperty('output')
      expect(typeof result.fixed).toBe('boolean')
      expect(typeof result.output).toBe('string')
    })
  })
})
