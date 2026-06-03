import type { ExtensionContext, ToolCallEvent, ToolResultEvent } from '../../src/omp-types'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { resolveFromToolCall, resolveFromToolResult } from '../../src/phases/resolve-path'

const TMP = join(tmpdir(), 'oxlint-gate-resolve-test')
const TS_FILE = join(TMP, 'example.ts')

afterAll(() => {
  rmSync(TMP, { recursive: true, force: true })
})

// Create a real TS file for existence check
mkdirSync(TMP, { recursive: true })
writeFileSync(TS_FILE, 'export const x = 1\n')

const ctx: ExtensionContext = { cwd: TMP }

describe('resolveFromToolCall', () => {
  it('should resolve a valid edit tool call with direct path', () => {
    const event: ToolCallEvent = {
      toolName: 'edit',
      input: { path: TS_FILE },
    }
    const result = resolveFromToolCall(event, ctx)
    expect(result).toEqual({ filePath: TS_FILE, toolName: 'edit' })
  })

  it('should resolve a write tool call', () => {
    const event: ToolCallEvent = {
      toolName: 'write',
      input: { path: TS_FILE },
    }
    const result = resolveFromToolCall(event, ctx)
    expect(result).toEqual({ filePath: TS_FILE, toolName: 'write' })
  })

  it('should return undefined for non-write tools', () => {
    const event: ToolCallEvent = {
      toolName: 'read',
      input: { path: TS_FILE },
    }
    expect(resolveFromToolCall(event, ctx)).toBeUndefined()
  })

  it('should return undefined for non-TS file extensions', () => {
    const jsonFile = join(TMP, 'data.json')
    writeFileSync(jsonFile, '{}')
    const event: ToolCallEvent = {
      toolName: 'edit',
      input: { path: jsonFile },
    }
    expect(resolveFromToolCall(event, ctx)).toBeUndefined()
  })

  it('should return undefined for nonexistent file', () => {
    const event: ToolCallEvent = {
      toolName: 'edit',
      input: { path: '/tmp/no-such-file.ts' },
    }
    expect(resolveFromToolCall(event, ctx)).toBeUndefined()
  })

  it('should resolve hashline input', () => {
    const event: ToolCallEvent = {
      toolName: 'edit',
      input: { input: `¶${TS_FILE}#abc\nreplace 1..1:\n+code` },
    }
    const result = resolveFromToolCall(event, ctx)
    expect(result).toEqual({ filePath: TS_FILE, toolName: 'edit' })
  })

  it('should resolve relative paths against cwd', () => {
    const event: ToolCallEvent = {
      toolName: 'edit',
      input: { path: 'example.ts' },
    }
    const result = resolveFromToolCall(event, ctx)
    expect(result).toEqual({ filePath: TS_FILE, toolName: 'edit' })
  })
})

describe('resolveFromToolResult', () => {
  it('should resolve a valid tool result', () => {
    const event: ToolResultEvent = {
      toolName: 'edit',
      input: { path: TS_FILE },
      output: 'done',
    }
    const result = resolveFromToolResult(event, ctx)
    expect(result).toEqual({ filePath: TS_FILE, toolName: 'edit' })
  })

  it('should return undefined for non-write tools', () => {
    const event: ToolResultEvent = {
      toolName: 'bash',
      input: { command: 'ls' },
      output: 'file.ts',
    }
    expect(resolveFromToolResult(event, ctx)).toBeUndefined()
  })
})
