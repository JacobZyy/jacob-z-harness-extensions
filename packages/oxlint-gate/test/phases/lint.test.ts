import type { ToolContext } from '../../src/lib/tools'
import { describe, expect, it, vi } from 'vitest'
import { MAX_FIX_ATTEMPTS } from '../../src/lib/log'
import { runLintPhase } from '../../src/phases/lint'

function makeMockLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }
}

function makeToolCtx(overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    pi: { sendMessage: vi.fn(), on: vi.fn(), logger: makeMockLogger() } as unknown as ToolContext['pi'],
    filePath: '/tmp/test.ts',
    cwd: process.cwd(),
    fixCount: 0,
    log: makeMockLogger() as unknown as ToolContext['log'],
    ...overrides,
  }
}

describe('runLintPhase', () => {
  it('should return undefined when fixCount >= MAX_FIX_ATTEMPTS', () => {
    const ctx = makeToolCtx({ fixCount: MAX_FIX_ATTEMPTS })
    const result = runLintPhase(ctx)
    expect(result).toBeUndefined()
  })

  it('should return undefined when fixCount exceeds MAX_FIX_ATTEMPTS', () => {
    const ctx = makeToolCtx({ fixCount: 10 })
    const result = runLintPhase(ctx)
    expect(result).toBeUndefined()
  })

  it('should delegate to runLint when under fix limit', () => {
    const ctx = makeToolCtx({
      fixCount: 0,
      filePath: 'src/lib/tools.ts',
    })
    // Should not throw, returns undefined or a result
    const result = runLintPhase(ctx)
    expect(result === undefined || (result !== undefined && 'content' in result!)).toBe(true)
  })
})
