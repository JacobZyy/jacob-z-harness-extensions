import { describe, expect, it } from 'vitest'
import { getEnvType, getGitNamespace } from './git-ops'

describe('git-ops', () => {
  describe('getGitNamespace', () => {
    it('extracts group from SSH URL', () => {
      expect(getGitNamespace('git@gitlab.example.com:zz-fe-u/nlab_sale.git'))
        .toBe('zz-fe-u')
    })

    it('extracts group from HTTPS URL', () => {
      expect(getGitNamespace('https://gitlab.example.com/group/project.git'))
        .toBe('group')
    })

    it('extracts group without .git suffix', () => {
      expect(getGitNamespace('git@gitlab.example.com:group/project'))
        .toBe('group')
    })

    it('returns unknown for unparseable URL', () => {
      expect(getGitNamespace('')).toBe('unknown')
    })

    it('handles nested groups (only first segment)', () => {
      expect(getGitNamespace('git@gitlab.example.com:org/team/project.git'))
        .toBe('org')
    })
  })

  describe('getEnvType', () => {
    it('returns internal for gitlab hosts', () => {
      expect(getEnvType('git@gitlab.example.com:group/project.git')).toBe('internal')
    })

    it('returns external for github.com', () => {
      expect(getEnvType('git@github.com:user/repo.git')).toBe('external')
    })

    it('returns external for empty string', () => {
      expect(getEnvType('')).toBe('external')
    })
  })
})
