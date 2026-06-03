import { describe, expect, it } from 'vitest'
import { MAX_OUTPUT_LINES, truncateOutput } from '../../src/lib/log'

describe('truncateOutput', () => {
  it('should return output as-is when within limit', () => {
    const short = 'line 1\nline 2\nline 3'
    expect(truncateOutput(short)).toBe(short)
  })

  it('should truncate output exceeding max lines', () => {
    const lines = Array.from({ length: 30 }, (_, i) => `line ${i + 1}`)
    const input = lines.join('\n')
    const result = truncateOutput(input)
    expect(result).toContain('lines truncated')
  })

  it('should use custom maxLines', () => {
    const lines = Array.from({ length: 10 }, (_, i) => `line ${i + 1}`)
    const input = lines.join('\n')
    const result = truncateOutput(input, 5)
    expect(result).toContain('lines truncated')
  })

  it('should preserve first 10 and last 5 lines when truncating', () => {
    const lines = Array.from({ length: 30 }, (_, i) => `line ${i + 1}`)
    const input = lines.join('\n')
    const result = truncateOutput(input)
    expect(result).toContain('line 1')
    expect(result).toContain('line 30')
  })

  it('should handle empty string', () => {
    expect(truncateOutput('')).toBe('')
  })

  it('should handle single line', () => {
    expect(truncateOutput('only line')).toBe('only line')
  })

  it('should not truncate at exactly maxLines', () => {
    const lines = Array.from({ length: MAX_OUTPUT_LINES }, (_, i) => `line ${i + 1}`)
    const input = lines.join('\n')
    expect(truncateOutput(input)).toBe(input)
  })
})
