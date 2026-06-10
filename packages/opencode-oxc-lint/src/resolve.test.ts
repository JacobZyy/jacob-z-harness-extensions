import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { countLines, extractToolPaths, filterLintableFiles } from './resolve'

describe('resolve', () => {
  let dir: string

  beforeEach(() => {
    dir = join(tmpdir(), `opencode-oxc-lint-${Date.now()}-${Math.random().toString(16).slice(2)}`)
    mkdirSync(dir, { recursive: true })
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('extracts write and edit paths from args', () => {
    expect(extractToolPaths('write', { filePath: 'src/a.ts' })).toEqual(['src/a.ts'])
    expect(extractToolPaths('edit', { path: 'src/b.ts' })).toEqual(['src/b.ts'])
  })

  it('extracts apply_patch paths from patch text', () => {
    const patch = `*** Begin Patch
*** Add File: src/new.ts
++export const a = 1
*** Update File: src/existing.ts
@@
-old
+new
*** Delete File: src/deleted.ts
*** End Patch`

    expect(extractToolPaths('apply_patch', { patchText: patch })).toEqual([
      'src/new.ts',
      'src/existing.ts',
      'src/deleted.ts',
    ])
  })

  it('returns no paths for unknown tools', () => {
    expect(extractToolPaths('bash', { command: 'touch src/a.ts' })).toEqual([])
  })

  it('counts lines', () => {
    const file = join(dir, 'sample.ts')
    writeFileSync(file, 'a\nb\nc\n')

    expect(countLines(file)).toBe(3)
  })

  it('filters existing supported files under max line count', () => {
    const small = join(dir, 'small.ts')
    const large = join(dir, 'large.ts')
    const markdown = join(dir, 'note.md')

    writeFileSync(small, 'export const a = 1\n')
    writeFileSync(large, `${Array.from({ length: 2001 }).fill('x').join('\n')}\n`)
    writeFileSync(markdown, '# note\n')

    const files = filterLintableFiles([small, large, markdown, join(dir, 'missing.ts')], {
      cwd: dir,
      extensions: ['.ts'],
      maxLines: 2000,
    })

    expect(files).toEqual([small])
  })

  it('filters out test-like files', () => {
    const source = join(dir, 'source.ts')
    const test = join(dir, 'source.test.ts')
    const spec = join(dir, 'source.spec.ts')

    writeFileSync(source, 'export const source = 1\n')
    writeFileSync(test, 'export const test = 1\n')
    writeFileSync(spec, 'export const spec = 1\n')

    const files = filterLintableFiles([source, test, spec], {
      cwd: dir,
      extensions: ['.ts'],
      maxLines: 2000,
    })

    expect(files).toEqual([source])
  })
})
