/**
 * Integration tests for get-browser-cookie.
 * Requires macOS + Chrome (or other supported browser) logged into target domains.
 * These tests hit real browser cookie databases — skipped in CI.
 *
 * Run locally: CI= bunx vitest run integration
 */
import { execSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { loadAllCookies } from './chromium'

const isMacOS = process.platform === 'darwin'
const hasSecurityCli = (() => {
  try {
    execSync('which security', { stdio: 'pipe' })
    return true
  }
  catch {
    return false
  }
})()

const runCookieTests = !process.env.CI && isMacOS && hasSecurityCli

describe.skipIf(!runCookieTests)('integration: loadAllCookies', () => {
  it('fetches cookies from zapi.zhuanspirit.com via Chrome', async () => {
    const result = await loadAllCookies('zapi.zhuanspirit.com')
    expect(result.cookies.length).toBeGreaterThan(0)
    expect(result.browser).toBeTruthy()
    expect(result.count).toBe(result.cookies.length)

    const names = result.cookies.map(c => c.name)
    expect(names).toContain('_yapi_token')
    expect(names).toContain('_yapi_uid')

    // Every cookie should have non-empty value and correct domain
    for (const cookie of result.cookies) {
      expect(cookie.value).toBeTruthy()
      expect(cookie.domain).toContain('zapi.zhuanspirit.com')
    }
  }, 30_000)

  it('returns empty result for a domain with no cookies', async () => {
    const result = await loadAllCookies('nonexistent.test.example.com')
    expect(result.cookies).toEqual([])
    expect(result.count).toBe(0)
  }, 30_000)
})
