/**
 * Chromium cookie decryption and SQLite query.
 * Uses Node.js crypto for AES-128-CBC decryption and bun:sqlite for DB access.
 */

import type { Database } from 'bun:sqlite'
import type { BrowserConfig, Cookie, CookieResult } from './types'
import { Buffer } from 'node:buffer'
import { createDecipheriv, pbkdf2Sync } from 'node:crypto'
import { detectAvailableBrowsers, expandTilde } from './detect-browser'
import { getKeychainPassword } from './keychain'

const SALT = 'saltysalt'
const ITERATIONS = 1003
const KEY_LENGTH = 16
const IV = Buffer.alloc(16, 0x20) // 16 bytes of space (0x20)
const V10_PREFIX = 'v10'

/** Derive the AES-128-CBC key from a Keychain password using PBKDF2. */
export function deriveKey(password: string): Buffer {
  return pbkdf2Sync(password, SALT, ITERATIONS, KEY_LENGTH, 'sha1')
}

/** Decrypt a Chromium encrypted cookie value (v10 format). */
export function decryptChromiumValue(encrypted: string, key: Buffer): string | null {
  if (!encrypted.startsWith(V10_PREFIX)) {
    // Not encrypted — plaintext
    return encrypted
  }

  const raw = Buffer.from(encrypted.slice(V10_PREFIX.length), 'base64')
  // Skip 3-byte prefix after v10
  if (raw.length < 3 + 16) {
    return null
  }
  const ciphertext = raw.subarray(3)

  try {
    const decipher = createDecipheriv('aes-128-cbc', key, IV)
    decipher.setAutoPadding(false)
    let decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])

    // PKCS7 unpadding
    const padLen = decrypted[decrypted.length - 1] ?? 0
    if (padLen > 0 && padLen <= 16) {
      decrypted = decrypted.subarray(0, decrypted.length - padLen)
    }

    // Skip first 32 bytes
    if (decrypted.length <= 32) {
      return null
    }
    decrypted = decrypted.subarray(32)

    return decrypted.toString('utf-8')
  }
  catch {
    return null
  }
}

/** Convert Chrome timestamp (microseconds since 1601-01-01) to Unix seconds. */
export function chromeTimestampToUnix(ts: number): number | null {
  if (ts === 0)
    return null
  // Chrome epoch: 1601-01-01 00:00:00 UTC
  // Unix epoch: 1970-01-01 00:00:00 UTC
  // Difference: 11644473600 seconds
  const chromeEpochDiffMicros = BigInt(11644473600) * 1_000_000n
  const unixMicros = BigInt(ts) - chromeEpochDiffMicros
  return Number(unixMicros / 1_000_000n)
}

/**
 * Query cookies from a Chromium browser's SQLite database.
 * Returns cookies matching the domain filter and optional cookie name.
 */
export async function loadCookies(
  browserConfig: BrowserConfig,
  domain: string,
  cookieName?: string,
): Promise<CookieResult | null> {
  const password = getKeychainPassword(
    browserConfig.keychainService,
    browserConfig.keychainAccount,
  )
  if (!password)
    return null

  const key = deriveKey(password)
  const dbPath = expandTilde(browserConfig.cookieDbPath)

  let db: Database | null = null
  try {
    // Dynamic import required: bun:sqlite only exists in Bun runtime
    const { Database } = await import('bun:sqlite')
    db = new Database(dbPath, { readonly: true, create: false })
  }
  catch {
    return null
  }

  try {
    let query = 'SELECT name, encrypted_value, host_key, path, expires_utc FROM cookies WHERE host_key LIKE ?'
    const params: (string | number)[] = [`%${domain}%`]

    if (cookieName) {
      query += ' AND name = ?'
      params.push(cookieName)
    }

    const stmt = db.prepare(query)
    const rows = stmt.all(...params) as Array<{
      name: string
      encrypted_value: string | Buffer
      host_key: string
      path: string
      expires_utc: number
    }>

    const cookies: Cookie[] = []
    for (const row of rows) {
      const raw = typeof row.encrypted_value === 'string'
        ? row.encrypted_value
        : row.encrypted_value.toString('utf-8')

      let value: string
      if (raw.startsWith(V10_PREFIX)) {
        const decrypted = decryptChromiumValue(raw, key)
        value = decrypted ?? ''
      }
      else {
        value = raw
      }

      cookies.push({
        name: row.name,
        value,
        domain: row.host_key,
        path: row.path,
      })
    }

    return {
      cookies,
      count: cookies.length,
      browser: browserConfig.name,
    }
  }
  finally {
    db.close()
  }
}

/**
 * 按优先级尝试所有可用浏览器获取 cookies。
 * 返回第一个成功获取到 cookie 的结果。
 */
export async function loadAllCookies(domain: string, cookieName?: string): Promise<CookieResult> {
  const browsers = detectAvailableBrowsers()
  for (const browser of browsers) {
    const result = await loadCookies(browser, domain, cookieName)
    if (result && result.cookies.length > 0) {
      return result
    }
  }
  return { cookies: [], count: 0, browser: '' }
}
