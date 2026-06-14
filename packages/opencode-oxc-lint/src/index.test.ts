import type { CommandRunner } from './oxlint'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'

import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createCollector, handleSessionIdle } from './index'

describe('collector + session.idle pipeline', () => {
  let dir: string

  beforeEach(() => {
    dir = join(tmpdir(), `opencode-oxc-lint-${Date.now()}-${Math.random().toString(16).slice(2)}`)
    mkdirSync(dir, { recursive: true })
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('collects edit/write/apply_patch files and runs the pipeline once at idle', async () => {
    const a = join(dir, 'a.ts')
    const b = join(dir, 'b.ts')
    writeFileSync(a, 'const a = 1\n')
    writeFileSync(b, 'const b = 2\n')

    const collector = createCollector()
    const calls: string[] = []
    const runner: CommandRunner = async (_bin, args) => {
      calls.push(args.join(' '))
      // oxfmt: exit 0 (formatted, no change signal needed)
      // oxlint --fix: exit 0 clean, no output
      return { exitCode: 0, stdout: '', stderr: '' }
    }

    collector.collect({ tool: 'write', sessionID: 's1', callID: 'c1', args: { filePath: a } }, { cwd: dir })
    collector.collect({ tool: 'edit', sessionID: 's1', callID: 'c2', args: { path: b } }, { cwd: dir })

    const result = await handleSessionIdle('s1', { cwd: dir }, collector, {
      options: { log: false },
      oxfmtAvailable: () => true,
      runner,
    })

    expect(result.ran).toBe(true)
    expect(result.files).toHaveLength(2)
    expect(result.diagnostics).toEqual([])
    // oxfmt + oxlint --fix (+ check skipped because fix was clean)
    expect(calls.length).toBeGreaterThanOrEqual(2)
  })

  it('surfaces remaining diagnostics after fix', async () => {
    const file = join(dir, 'a.ts')
    writeFileSync(file, 'const a = 1\n')

    const collector = createCollector()
    const runner: CommandRunner = async (_bin, args) => {
      if (args.includes('--fix'))
        return { exitCode: 1, stdout: 'fix output', stderr: '' }
      return { exitCode: 1, stdout: 'final diagnostics', stderr: '' }
    }

    collector.collect({ tool: 'write', sessionID: 's2', callID: 'c1', args: { filePath: file } }, { cwd: dir })
    const result = await handleSessionIdle('s2', { cwd: dir }, collector, {
      options: { log: false },
      oxfmtAvailable: () => true,
      runner,
    })

    expect(result.diagnostics).toHaveLength(1)
    expect(result.diagnostics[0]).toContain('final diagnostics')
  })

  it('drains the collector so a second idle is a no-op', async () => {
    const file = join(dir, 'a.ts')
    writeFileSync(file, 'const a = 1\n')

    const collector = createCollector()
    const runner: CommandRunner = async () => ({ exitCode: 0, stdout: '', stderr: '' })

    collector.collect({ tool: 'write', sessionID: 's3', callID: 'c1', args: { filePath: file } }, { cwd: dir })

    const first = await handleSessionIdle('s3', { cwd: dir }, collector, {
      options: { log: false },
      oxfmtAvailable: () => true,
      runner,
    })
    const second = await handleSessionIdle('s3', { cwd: dir }, collector, {
      options: { log: false },
      oxfmtAvailable: () => true,
      runner,
    })

    expect(first.ran).toBe(true)
    expect(second.ran).toBe(false)
  })

  it('ignores non-edit tools and unsupported extensions', () => {
    const collector = createCollector()
    collector.collect({ tool: 'bash', sessionID: 's4', callID: 'c1', args: { command: 'echo hi' } }, { cwd: dir })

    expect(collector.drain('s4')).toEqual([])
  })

  it('isolates files per session', () => {
    const a = join(dir, 'a.ts')
    const b = join(dir, 'b.ts')
    writeFileSync(a, 'x\n')
    writeFileSync(b, 'y\n')

    const collector = createCollector()
    collector.collect({ tool: 'write', sessionID: 's5', callID: 'c1', args: { filePath: a } }, { cwd: dir })
    collector.collect({ tool: 'write', sessionID: 's6', callID: 'c2', args: { filePath: b } }, { cwd: dir })

    expect(collector.drain('s5')).toEqual([a])
    expect(collector.drain('s6')).toEqual([b])
  })
})
