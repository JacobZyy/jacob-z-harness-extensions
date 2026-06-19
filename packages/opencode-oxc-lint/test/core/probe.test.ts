import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { detectLinter, probeAndInject } from '../../src/core/probe'

describe('probe', () => {
  let dir: string

  beforeEach(() => {
    dir = join(tmpdir(), `probe-${Date.now()}-${Math.random().toString(16).slice(2)}`)
    mkdirSync(dir, { recursive: true })
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  function writePkg(deps: Record<string, string>, as: 'devDependencies' | 'dependencies' = 'devDependencies') {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'demo', [as]: deps }))
  }

  describe('detectLinter', () => {
    it('returns undefined without package.json', () => {
      expect(detectLinter(dir)).toBeUndefined()
    })

    it('detects eslint via @antfu/eslint-config', () => {
      writePkg({ '@antfu/eslint-config': '^9.0.0' })
      expect(detectLinter(dir)).toBe('eslint')
    })

    it('detects eslint via @zz-yp/nlab_eslint_config', () => {
      writePkg({ '@zz-yp/nlab_eslint_config': '^1.0.0' })
      expect(detectLinter(dir)).toBe('eslint')
    })

    it('detects eslint from dependencies too', () => {
      writePkg({ '@antfu/eslint-config': '^9.0.0' }, 'dependencies')
      expect(detectLinter(dir)).toBe('eslint')
    })

    it('returns undefined when no eslint config package present', () => {
      writePkg({ axios: '^1.0.0' })
      expect(detectLinter(dir)).toBeUndefined()
    })

    it('detects eslint from an ancestor package.json (monorepo)', () => {
      // 子目录无 package.json，根（dir）有 @antfu/eslint-config
      mkdirSync(join(dir, 'packages', 'child'), { recursive: true })
      writeFileSync(
        join(dir, 'package.json'),
        JSON.stringify({ name: 'monorepo-root', devDependencies: { '@antfu/eslint-config': '^9.0.0' } }),
      )
      expect(detectLinter(join(dir, 'packages', 'child'))).toBe('eslint')
    })
  })

  describe('probeAndInject', () => {
    it('does nothing when no eslint config package is present', () => {
      writePkg({ axios: '^1.0.0' })
      expect(probeAndInject(dir)).toBeUndefined()
      expect(existsSync(join(dir, '.jacob-z', 'jacob-z-harness-opencode.json'))).toBe(false)
    })

    it('injects linter=eslint into the project config when detected', () => {
      writePkg({ '@antfu/eslint-config': '^9.0.0' })
      const result = probeAndInject(dir)

      expect(result).toEqual({ linter: 'eslint', written: true })
      const cfg = JSON.parse(readFileSync(join(dir, '.jacob-z', 'jacob-z-harness-opencode.json'), 'utf8'))
      expect(cfg['oxc-lint'].linter).toBe('eslint')
    })

    it('preserves existing config fields when injecting', () => {
      writePkg({ '@antfu/eslint-config': '^9.0.0' })
      mkdirSync(join(dir, '.jacob-z'), { recursive: true })
      writeFileSync(
        join(dir, '.jacob-z', 'jacob-z-harness-opencode.json'),
        JSON.stringify({ 'oxc-lint': { mode: 'notify' } }),
      )

      const result = probeAndInject(dir)
      expect(result?.written).toBe(true)

      const cfg = JSON.parse(readFileSync(join(dir, '.jacob-z', 'jacob-z-harness-opencode.json'), 'utf8'))
      expect(cfg['oxc-lint'].linter).toBe('eslint')
      expect(cfg['oxc-lint'].mode).toBe('notify')
    })

    it('does not overwrite an explicit linter choice', () => {
      writePkg({ '@antfu/eslint-config': '^9.0.0' })
      mkdirSync(join(dir, '.jacob-z'), { recursive: true })
      writeFileSync(
        join(dir, '.jacob-z', 'jacob-z-harness-opencode.json'),
        JSON.stringify({ 'oxc-lint': { linter: 'oxlint' } }),
      )

      const result = probeAndInject(dir)
      expect(result).toEqual({ linter: 'oxlint', written: false })

      const cfg = JSON.parse(readFileSync(join(dir, '.jacob-z', 'jacob-z-harness-opencode.json'), 'utf8'))
      expect(cfg['oxc-lint'].linter).toBe('oxlint')
    })

    it('is idempotent on repeated runs', () => {
      writePkg({ '@antfu/eslint-config': '^9.0.0' })
      const first = probeAndInject(dir)
      expect(first).toEqual({ linter: 'eslint', written: true })

      const second = probeAndInject(dir)
      expect(second).toEqual({ linter: 'eslint', written: false })
    })

    it('adds .jacob-z to .gitignore when injecting', () => {
      writePkg({ '@antfu/eslint-config': '^9.0.0' })
      probeAndInject(dir)
      const gi = readFileSync(join(dir, '.gitignore'), 'utf8')
      expect(gi).toContain('.jacob-z/*')
    })

    it('preserves existing .gitignore content when appending', () => {
      writePkg({ '@antfu/eslint-config': '^9.0.0' })
      writeFileSync(join(dir, '.gitignore'), 'node_modules\ndist\n')
      probeAndInject(dir)
      const gi = readFileSync(join(dir, '.gitignore'), 'utf8')
      expect(gi).toContain('node_modules')
      expect(gi).toContain('dist')
      expect(gi).toContain('.jacob-z/*')
    })

    it('does not duplicate .jacob-z in .gitignore', () => {
      writePkg({ '@antfu/eslint-config': '^9.0.0' })
      writeFileSync(join(dir, '.gitignore'), '.jacob-z\n')
      probeAndInject(dir)
      const gi = readFileSync(join(dir, '.gitignore'), 'utf8')
      expect(gi.match(/\.jacob-z/g)?.length).toBe(1)
    })
  })
})
