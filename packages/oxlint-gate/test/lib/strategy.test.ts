import type { LintStrategyCache } from '../../src/lib/strategy'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { loadStrategy } from '../../src/lib/strategy'

const TMP = join(tmpdir(), 'oxlint-gate-strategy-test')

afterAll(() => {
  rmSync(TMP, { recursive: true, force: true })
})

describe('strategy', () => {
  describe('loadStrategy', () => {
    it('should return oxlint when no eslint in package.json', () => {
      const projectDir = join(TMP, 'no-eslint')
      mkdirSync(projectDir, { recursive: true })
      writeFileSync(join(projectDir, 'package.json'), JSON.stringify({ name: 'test' }))

      const result: LintStrategyCache = loadStrategy(projectDir)
      expect(result.strategy).toBe('oxlint')
      expect(result.eslintVersion).toBeUndefined()
      expect(result.sniffedAt).toBeDefined()
    })

    it('should return eslint for eslint >= 9', () => {
      const projectDir = join(TMP, 'eslint-9')
      mkdirSync(projectDir, { recursive: true })
      writeFileSync(
        join(projectDir, 'package.json'),
        JSON.stringify({ devDependencies: { eslint: '^9.1.0' } }),
      )

      const result: LintStrategyCache = loadStrategy(projectDir)
      expect(result.strategy).toBe('eslint')
      expect(result.eslintVersion).toBe('9.1.0')
    })

    it('should return oxlint for eslint < 9', () => {
      const projectDir = join(TMP, 'eslint-8')
      mkdirSync(projectDir, { recursive: true })
      writeFileSync(
        join(projectDir, 'package.json'),
        JSON.stringify({ devDependencies: { eslint: '^8.50.0' } }),
      )

      const result: LintStrategyCache = loadStrategy(projectDir)
      expect(result.strategy).toBe('oxlint')
    })

    it('should return oxlint for eslint in dependencies (not devDependencies)', () => {
      const projectDir = join(TMP, 'eslint-deps')
      mkdirSync(projectDir, { recursive: true })
      writeFileSync(
        join(projectDir, 'package.json'),
        JSON.stringify({ dependencies: { eslint: '^9.5.0' } }),
      )

      const result: LintStrategyCache = loadStrategy(projectDir)
      expect(result.strategy).toBe('eslint')
      expect(result.eslintVersion).toBe('9.5.0')
    })

    it('should handle corrupt package.json gracefully', () => {
      const projectDir = join(TMP, 'corrupt-pkg')
      mkdirSync(projectDir, { recursive: true })
      writeFileSync(join(projectDir, 'package.json'), 'not json at all')

      const result: LintStrategyCache = loadStrategy(projectDir)
      expect(result.strategy).toBe('oxlint')
    })

    it('should handle missing package.json', () => {
      const projectDir = join(TMP, 'no-pkg')
      mkdirSync(projectDir, { recursive: true })

      const result: LintStrategyCache = loadStrategy(projectDir)
      expect(result.strategy).toBe('oxlint')
    })

    it('should persist cache to .omp/lint-strategy.json', () => {
      const projectDir = join(TMP, 'cached')
      mkdirSync(projectDir, { recursive: true })
      writeFileSync(join(projectDir, 'package.json'), JSON.stringify({ name: 'test' }))

      loadStrategy(projectDir)

      const cachePath = join(projectDir, '.omp', 'lint-strategy.json')
      const cached = JSON.parse(
        readFileSync(cachePath, 'utf8'),
      ) as LintStrategyCache
      expect(cached.strategy).toBe('oxlint')
    })

    it('should return cached result on second call', () => {
      const projectDir = join(TMP, 'cached-twice')
      mkdirSync(projectDir, { recursive: true })
      writeFileSync(join(projectDir, 'package.json'), JSON.stringify({ name: 'test' }))

      const first = loadStrategy(projectDir)
      const second = loadStrategy(projectDir)
      expect(first).toBe(second) // same reference from in-memory cache
    })
  })
})
