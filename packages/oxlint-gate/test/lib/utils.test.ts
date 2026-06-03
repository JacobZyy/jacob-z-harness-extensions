import { describe, expect, it } from 'vitest'
import { expandTilde, extractFilePath, isExistingFile, matchesIgnorePattern, resolveFilePath } from '../../src/lib/utils'

// ── extractFilePath ─────────────────────────────────────────────────────

describe('extractFilePath', () => {
  it('should extract from direct path field', () => {
    expect(extractFilePath({ path: '/foo/bar.ts' })).toBe('/foo/bar.ts')
  })

  it('should extract from hashline ¶ prefix', () => {
    expect(extractFilePath({ input: '¶/foo/bar.ts#abc\nreplace 1..1:\n+code' })).toBe('/foo/bar.ts')
  })

  it('should extract from hashline § prefix', () => {
    expect(extractFilePath({ input: '§/foo/bar.ts#abc\nreplace 1..1:\n+code' })).toBe('/foo/bar.ts')
  })

  it('should extract from hashline @ prefix', () => {
    expect(extractFilePath({ input: '@/foo/bar.ts#abc\nreplace 1..1:\n+code' })).toBe('/foo/bar.ts')
  })

  it('should extract from apply-patch Add File', () => {
    expect(extractFilePath({ input: '*** Add File: /foo/bar.ts\n+content' })).toBe('/foo/bar.ts')
  })

  it('should extract from apply-patch Update File', () => {
    expect(extractFilePath({ input: '*** Update File: /foo/bar.ts\n-old\n+new' })).toBe('/foo/bar.ts')
  })

  it('should extract from apply-patch Delete File', () => {
    expect(extractFilePath({ input: '*** Delete File: /foo/bar.ts' })).toBe('/foo/bar.ts')
  })

  it('should return undefined for missing path', () => {
    expect(extractFilePath({ content: 'some content' })).toBeUndefined()
  })

  it('should return undefined for empty path', () => {
    expect(extractFilePath({ path: '' })).toBeUndefined()
  })

  it('should return undefined for empty input string', () => {
    expect(extractFilePath({ input: '' })).toBeUndefined()
  })

  it('should extract path with spaces from apply-patch', () => {
    expect(extractFilePath({ input: '*** Add File:  /foo/bar baz.ts\n+content' })).toBe('/foo/bar baz.ts')
  })
})

// ── expandTilde ─────────────────────────────────────────────────────────

describe('expandTilde', () => {
  it('should expand bare ~', () => {
    const result = expandTilde('~')
    expect(result).not.toContain('~')
    expect(result.length).toBeGreaterThan(0)
  })

  it('should expand ~/path', () => {
    const result = expandTilde('~/Documents/file.ts')
    expect(result).not.toContain('~')
    expect(result).toContain('Documents/file.ts')
  })

  it('should not modify absolute paths', () => {
    expect(expandTilde('/usr/local/bin')).toBe('/usr/local/bin')
  })

  it('should not modify relative paths', () => {
    expect(expandTilde('src/index.ts')).toBe('src/index.ts')
  })
})

// ── resolveFilePath ─────────────────────────────────────────────────────

describe('resolveFilePath', () => {
  it('should keep absolute paths as-is', () => {
    expect(resolveFilePath('/foo/bar.ts', '/project')).toBe('/foo/bar.ts')
  })

  it('should resolve relative paths against cwd', () => {
    expect(resolveFilePath('src/index.ts', '/project')).toBe('/project/src/index.ts')
  })

  it('should expand ~ in paths', () => {
    const result = resolveFilePath('~/file.ts', '/project')
    expect(result).not.toContain('~')
  })
})

// ── isExistingFile ──────────────────────────────────────────────────────

describe('isExistingFile', () => {
  it('should return true for an existing file', () => {
    // package.json exists in the workspace
    expect(isExistingFile('package.json')).toBe(true)
  })

  it('should return false for a nonexistent path', () => {
    expect(isExistingFile('/no/such/path/ever.ts')).toBe(false)
  })

  it('should return false for a directory', () => {
    expect(isExistingFile('src')).toBe(false)
  })
})

// ── matchesIgnorePattern ────────────────────────────────────────────────

describe('matchesIgnorePattern', () => {
  it('should return false for empty patterns', () => {
    expect(matchesIgnorePattern('/foo/bar.ts', [])).toBe(false)
  })

  it('should match simple extension glob against relative path', () => {
    expect(matchesIgnorePattern('bar.test.ts', ['*.test.ts'])).toBe(true)
  })

  it('should match double-star glob', () => {
    expect(matchesIgnorePattern('src/foo/bar.test.ts', ['**/*.test.ts'])).toBe(true)
  })

  it('should not match non-matching path', () => {
    expect(matchesIgnorePattern('bar.ts', ['*.test.ts'])).toBe(false)
  })

  it('should match against basename pattern', () => {
    expect(matchesIgnorePattern('bar.test.ts', ['bar.test.ts'])).toBe(true)
  })
})
