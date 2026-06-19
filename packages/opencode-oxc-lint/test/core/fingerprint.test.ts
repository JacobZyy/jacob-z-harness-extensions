import { describe, expect, it } from 'vitest'

import { hashDiagnostics } from '../../src/core/fingerprint'

describe('hashDiagnostics', () => {
  it('returns identical hashes for identical input', () => {
    expect(hashDiagnostics('no-debugger')).toBe(hashDiagnostics('no-debugger'))
  })

  it('returns different hashes for different input', () => {
    expect(hashDiagnostics('a')).not.toBe(hashDiagnostics('b'))
  })

  it('is a pure hash — volatile stripping is the adapter responsibility, not core', () => {
    // Core must NOT know about oxlint summary lines. Two messages that differ
    // only in timing must hash differently here; the adapter stabilizes them
    // before this is called.
    const fast = 'err\nFinished in 3ms'
    const slow = 'err\nFinished in 9ms'

    expect(hashDiagnostics(fast)).not.toBe(hashDiagnostics(slow))
  })
})
