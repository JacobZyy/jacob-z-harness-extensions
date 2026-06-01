import { afterEach, describe, expect, it, vi } from 'vitest'
import { getKeychainPassword } from './keychain'

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}))

describe('getKeychainPassword', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns the trimmed password on success', async () => {
    const { execFileSync } = await import('node:child_process')
    vi.mocked(execFileSync).mockReturnValue('my-secret-password\n')

    const result = getKeychainPassword('Chrome Safe Storage', 'Chrome')
    expect(result).toBe('my-secret-password')
    expect(execFileSync).toHaveBeenCalledWith(
      'security',
      ['find-generic-password', '-s', 'Chrome Safe Storage', '-a', 'Chrome', '-w'],
      expect.objectContaining({ encoding: 'utf-8' }),
    )
  })

  it('returns null when security command throws', async () => {
    const { execFileSync } = await import('node:child_process')
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error('security: item not found')
    })

    const result = getKeychainPassword('Nonexistent Service', 'user')
    expect(result).toBeNull()
  })

  it('returns null when stdout is empty or whitespace', async () => {
    const { execFileSync } = await import('node:child_process')
    vi.mocked(execFileSync).mockReturnValue('   \n')

    const result = getKeychainPassword('Some Service', 'account')
    expect(result).toBeNull()
  })

  it('returns null on unexpected errors', async () => {
    const { execFileSync } = await import('node:child_process')
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error('ENOENT: security not found')
    })

    const result = getKeychainPassword('Any', 'Any')
    expect(result).toBeNull()
  })
})
