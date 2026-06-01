/**
 * macOS Keychain password retrieval via `security` CLI.
 * Uses child_process.execFileSync for Node/Vitest compatibility.
 */

import { execFileSync } from 'node:child_process'

export function getKeychainPassword(service: string, account: string): string | null {
  try {
    const stdout = execFileSync(
      'security',
      ['find-generic-password', '-s', service, '-a', account, '-w'],
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
    )
    return stdout.trim() || null
  }
  catch {
    return null
  }
}
