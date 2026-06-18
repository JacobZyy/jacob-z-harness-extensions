import type { CommandRunner } from './oxlint'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'

import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createCollector, handleSessionIdle, handleToolAfter, hashDiagnostics } from './index'

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

describe('handleToolAfter immediate mode', () => {
  let dir: string

  beforeEach(() => {
    dir = join(tmpdir(), `opencode-oxc-lint-${Date.now()}-${Math.random().toString(16).slice(2)}`)
    mkdirSync(dir, { recursive: true })
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  function makeOutput() {
    return { title: 't', output: '', metadata: undefined }
  }

  function writeInput(file: string) {
    return { tool: 'write' as const, sessionID: 's1', callID: 'c1', args: { filePath: file } }
  }

  /** Runner that yields `msg` as the oxlint check output (fix exits 1 to trigger check). */
  function diagRunner(getMsg: () => string): CommandRunner {
    return async (_bin, args) => {
      if (args.includes('--fix'))
        return { exitCode: 1, stdout: '', stderr: '' }
      return { exitCode: 1, stdout: getMsg(), stderr: '' }
    }
  }

  it('injects diagnostics with [oxc-lint] prefix in fix mode', async () => {
    const file = join(dir, 'a.ts')
    writeFileSync(file, 'x\n')
    const output = makeOutput()

    const result = await handleToolAfter(
      writeInput(file),
      output,
      { cwd: dir },
      new Map(),
      { options: { log: false, mode: 'fix' }, oxfmtAvailable: () => false, runner: diagRunner(() => 'boom') },
    )

    expect(result.filesProcessed).toBe(1)
    expect(result.filesWithDiagnostics).toBe(1)
    expect(output.output).toContain('[oxc-lint]')
    expect(output.output).toContain('boom')
  })

  it('uses informational prefix in notify mode', async () => {
    const file = join(dir, 'a.ts')
    writeFileSync(file, 'x\n')
    const output = makeOutput()

    await handleToolAfter(
      writeInput(file),
      output,
      { cwd: dir },
      new Map(),
      { options: { log: false, mode: 'notify' }, oxfmtAvailable: () => false, runner: diagRunner(() => 'boom') },
    )

    expect(output.output).toContain('[oxc-lint: informational, no fix needed]')
    expect(output.output).toContain('boom')
  })

  it('does not inject output in silent mode but still processes the file', async () => {
    const file = join(dir, 'a.ts')
    writeFileSync(file, 'x\n')
    const output = makeOutput()

    const result = await handleToolAfter(
      writeInput(file),
      output,
      { cwd: dir },
      new Map(),
      { options: { log: false, mode: 'silent' }, oxfmtAvailable: () => false, runner: diagRunner(() => 'boom') },
    )

    expect(result.filesProcessed).toBe(1)
    expect(result.filesWithDiagnostics).toBe(1)
    expect(output.output).toBe('')
  })

  it('skips the pipeline entirely for ignored files', async () => {
    const file = join(dir, 'dist', 'a.ts')
    mkdirSync(join(dir, 'dist'), { recursive: true })
    writeFileSync(file, 'x\n')
    const output = makeOutput()

    const result = await handleToolAfter(
      writeInput(file),
      output,
      { cwd: dir },
      new Map(),
      { options: { log: false, ignore: ['dist/**'] }, oxfmtAvailable: () => false, runner: diagRunner(() => 'boom') },
    )

    expect(result.filesProcessed).toBe(0)
    expect(result.filesWithDiagnostics).toBe(0)
    expect(output.output).toBe('')
  })

  it('stops injecting identical diagnostics after maxHints repetitions', async () => {
    const file = join(dir, 'a.ts')
    writeFileSync(file, 'x\n')
    const states = new Map()
    const deps = {
      options: { log: false, maxHints: 2 },
      oxfmtAvailable: () => false,
      runner: diagRunner(() => 'same-error'),
    }

    const first = makeOutput()
    await handleToolAfter(writeInput(file), first, { cwd: dir }, states, deps)
    expect(first.output).toContain('same-error')

    const second = makeOutput()
    await handleToolAfter(writeInput(file), second, { cwd: dir }, states, deps)
    expect(second.output).toContain('same-error')

    const third = makeOutput()
    const result = await handleToolAfter(writeInput(file), third, { cwd: dir }, states, deps)
    expect(result.filesWithDiagnostics).toBe(1)
    expect(third.output).not.toContain('same-error')
  })

  it('resets the counter when diagnostics change', async () => {
    const file = join(dir, 'a.ts')
    writeFileSync(file, 'x\n')
    const states = new Map()
    let msg = 'err-one'
    const deps = {
      options: { log: false, maxHints: 1 },
      oxfmtAvailable: () => false,
      runner: diagRunner(() => msg),
    }

    const first = makeOutput()
    await handleToolAfter(writeInput(file), first, { cwd: dir }, states, deps)
    expect(first.output).toContain('err-one')

    const second = makeOutput()
    await handleToolAfter(writeInput(file), second, { cwd: dir }, states, deps)
    expect(second.output).not.toContain('err-one')

    msg = 'err-two'
    const third = makeOutput()
    await handleToolAfter(writeInput(file), third, { cwd: dir }, states, deps)
    expect(third.output).toContain('err-two')
  })

  it('clears hint state when a file goes clean', async () => {
    const file = join(dir, 'a.ts')
    writeFileSync(file, 'x\n')
    const states = new Map()
    let msg = 'err'
    const runner: CommandRunner = async (_bin, args) => {
      if (args.includes('--fix'))
        return { exitCode: msg ? 1 : 0, stdout: '', stderr: '' }
      return { exitCode: 1, stdout: msg, stderr: '' }
    }
    const deps = { options: { log: false, maxHints: 1 }, oxfmtAvailable: () => false, runner }

    const first = makeOutput()
    await handleToolAfter(writeInput(file), first, { cwd: dir }, states, deps)
    expect(first.output).toContain('err')

    msg = ''
    const clean = makeOutput()
    const cleanResult = await handleToolAfter(writeInput(file), clean, { cwd: dir }, states, deps)
    expect(cleanResult.filesWithDiagnostics).toBe(0)
    expect(clean.output).toBe('')

    msg = 'err'
    const after = makeOutput()
    await handleToolAfter(writeInput(file), after, { cwd: dir }, states, deps)
    expect(after.output).toContain('err')
  })
})

describe('hashDiagnostics', () => {
  it('strips volatile oxlint summary lines so timing/count changes do not alter the fingerprint', () => {
    const core = 'no-debugger\n  1 | debugger;\nhelp: Remove the debugger statement'
    const a = hashDiagnostics(
      `${core}\nFound 0 warnings and 1 error.\nFinished in 3ms on 1 file with 182 rules using 10 threads`,
    )
    const b = hashDiagnostics(
      `${core}\nFound 0 warnings and 1 error.\nFinished in 9ms on 1 file with 182 rules using 10 threads`,
    )
    expect(a).toBe(b)

    const different = hashDiagnostics(
      `eqeqeq\n  1 | a == b\nFound 0 warnings and 1 error.\nFinished in 3ms`,
    )
    expect(a).not.toBe(different)
  })
})
