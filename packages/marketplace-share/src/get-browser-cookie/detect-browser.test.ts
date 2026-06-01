import { afterEach, describe, expect, it, vi } from 'vitest'
import { detectAvailableBrowsers, expandTilde } from './detect-browser'

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
}))

vi.mock('node:os', () => ({
  homedir: () => '/Users/testuser',
}))

describe('expandTilde', () => {
  it('expands ~/ to home directory', () => {
    expect(expandTilde('~/Library/Application Support')).toBe(
      '/Users/testuser/Library/Application Support',
    )
  })

  it('leaves absolute paths unchanged', () => {
    expect(expandTilde('/absolute/path')).toBe('/absolute/path')
  })

  it('leaves relative paths unchanged', () => {
    expect(expandTilde('relative/path')).toBe('relative/path')
  })
})

describe('detectAvailableBrowsers', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns empty array when no browsers exist', async () => {
    const { existsSync } = await import('node:fs')
    vi.mocked(existsSync).mockReturnValue(false)

    const result = detectAvailableBrowsers()
    expect(result).toEqual([])
  })

  it('returns only browsers whose cookie DB exists', async () => {
    const { existsSync } = await import('node:fs')
    vi.mocked(existsSync).mockImplementation((path) => {
      const p = path.toString()
      return p.includes('Google/Chrome')
    })

    const result = detectAvailableBrowsers()
    expect(result).toHaveLength(1)
    expect(result[0]!.name).toBe('Chrome')
  })

  it('returns multiple browsers in priority order', async () => {
    const { existsSync } = await import('node:fs')
    vi.mocked(existsSync).mockImplementation((path) => {
      const p = path.toString()
      return p.includes('Brave') || p.includes('Edge')
    })

    const result = detectAvailableBrowsers()
    expect(result).toHaveLength(2)
    // Edge has higher priority than Brave in the list
    expect(result[0]!.name).toBe('Edge')
    expect(result[1]!.name).toBe('Brave')
  })

  it('expands tilde in cookie DB path before checking existence', async () => {
    const { existsSync } = await import('node:fs')
    vi.mocked(existsSync).mockReturnValue(false)

    detectAvailableBrowsers()

    // Should have been called with expanded paths (homedir is /Users/testuser)
    const calls = vi.mocked(existsSync).mock.calls.map(c => c[0].toString())
    for (const call of calls) {
      expect(call).not.toContain('~')
      expect(call).toContain('/Users/testuser')
    }
  })
})
