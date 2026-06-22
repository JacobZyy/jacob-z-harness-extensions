import type { LinterAdapter, NormalizedOptions } from '../../src/core/types'

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runPipelineForFile } from '../../src/core/pipeline'

const mockOptions = {
  linter: 'oxlint' as const,
  extensions: ['.ts'],
  maxLines: 5000,
  log: false,
  logPath: '',
  maxHints: 3,
  mode: 'fix' as const,
  ignore: [],
  oxlint: {
    bin: 'oxlint',
    configPath: undefined,
    disableNestedConfig: false,
    oxfmt: { bin: 'oxfmt', configPath: undefined, disableNestedConfig: false },
  },
  eslint: { bin: 'eslint', configPath: undefined },
} satisfies NormalizedOptions

function makeFormattingAdapter(transform: (content: string) => string): LinterAdapter {
  return {
    name: 'oxlint',
    format(filePath) {
      const before = readFileSync(filePath, 'utf8')
      const after = transform(before)
      writeFileSync(filePath, after)
      return Promise.resolve({ formatted: true, changed: before !== after, output: '' })
    },
    lint() {
      return Promise.resolve({ fixExitCode: 0 })
    },
  }
}

describe('runPipelineForFile format diff', () => {
  let dir: string

  beforeEach(() => {
    dir = join(tmpdir(), `opencode-oxc-lint-pipeline-${Date.now()}-${Math.random().toString(16).slice(2)}`)
    mkdirSync(dir, { recursive: true })
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('captures a unified diff when the formatter changes the file', async () => {
    const file = join(dir, 'a.ts')
    writeFileSync(file, 'const x=1\n')

    const adapter = makeFormattingAdapter(content => content.replace('x=1', 'x = 1'))
    const result = await runPipelineForFile(file, mockOptions, adapter)

    expect(result.changed).toBe(true)
    expect(result.formatDiff).toBeDefined()
    expect(result.formatDiff).toContain('x=1')
    expect(result.formatDiff).toContain('x = 1')
    expect(result.formatDiff).toContain('---')
    expect(result.formatDiff).toContain('+++')
    expect(result.formatDiff).toContain('-')
    expect(result.formatDiff).toContain('+')
  })

  it('omits formatDiff when the formatter does not change the file', async () => {
    const file = join(dir, 'a.ts')
    writeFileSync(file, 'const x = 1\n')

    const adapter = makeFormattingAdapter(content => content)
    const result = await runPipelineForFile(file, mockOptions, adapter)

    expect(result.changed).toBe(false)
    expect(result.formatDiff).toBeUndefined()
  })

  it('omits formatDiff when there is no format adapter', async () => {
    const file = join(dir, 'a.ts')
    writeFileSync(file, 'const x=1\n')

    const adapter: LinterAdapter = {
      name: 'eslint',
      lint() {
        return Promise.resolve({ fixExitCode: 0 })
      },
    }

    const result = await runPipelineForFile(file, mockOptions, adapter)
    expect(result.formatDiff).toBeUndefined()
  })
})
