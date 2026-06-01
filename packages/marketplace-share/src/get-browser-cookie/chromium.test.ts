import { Buffer } from 'node:buffer'
import { createCipheriv, pbkdf2Sync } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { chromeTimestampToUnix, decryptChromiumValue, deriveKey } from './chromium'

const SALT = 'saltysalt'
const ITERATIONS = 1003
const KEY_LENGTH = 16
const IV = Buffer.alloc(16, 0x20)

describe('deriveKey', () => {
  it('derives a 16-byte key using PBKDF2-SHA1 with correct parameters', () => {
    const password = 'test-password'
    const key = deriveKey(password)

    expect(key).toHaveLength(KEY_LENGTH)

    // Verify against a direct pbkdf2Sync call with the same params
    const expected = pbkdf2Sync(password, SALT, ITERATIONS, KEY_LENGTH, 'sha1')
    expect(key.equals(expected)).toBe(true)
  })

  it('produces deterministic output for the same password', () => {
    const a = deriveKey('my-secret')
    const b = deriveKey('my-secret')
    expect(a.equals(b)).toBe(true)
  })

  it('produces different keys for different passwords', () => {
    const a = deriveKey('password-a')
    const b = deriveKey('password-b')
    expect(a.equals(b)).toBe(false)
  })
})

describe('decryptChromiumValue', () => {
  /** Encrypt a plaintext value the same way Chromium does, for round-trip testing. */
  function encryptChromiumValue(plaintext: string, key: Buffer): string {
    const cipher = createCipheriv('aes-128-cbc', key, IV)
    cipher.setAutoPadding(false)
    // Decryptor skips first 32 bytes of the decrypted output,
    // so prepend 32 dummy bytes to the plaintext.
    const payload = Buffer.concat([Buffer.alloc(32, 0x00), Buffer.from(plaintext, 'utf-8')])
    // PKCS7 pad to 16-byte boundary
    const padLen = 16 - (payload.length % 16)
    const padded = Buffer.concat([payload, Buffer.alloc(padLen, padLen)])
    const ciphertext = Buffer.concat([cipher.update(padded), cipher.final()])
    // Decryptor skips first 3 bytes of the raw base64-decoded data
    const threeBytePrefix = Buffer.from([0x01, 0x00, 0x00])
    return `v10${Buffer.concat([threeBytePrefix, ciphertext]).toString('base64')}`
  }

  it('round-trips: encrypt then decrypt returns original plaintext', () => {
    const password = 'test-keychain-password'
    const key = deriveKey(password)
    const plaintext = 'session-token-value-12345'

    const encrypted = encryptChromiumValue(plaintext, key)
    expect(encrypted.startsWith('v10')).toBe(true)

    const decrypted = decryptChromiumValue(encrypted, key)
    expect(decrypted).toBe(plaintext)
  })

  it('returns null for empty payload (32-byte dummy prefix only)', () => {
    const password = 'pw'
    const key = deriveKey(password)
    const encrypted = encryptChromiumValue('', key)
    // After decrypting and removing PKCS7 padding, we get exactly 32 bytes
    // which is just the dummy prefix — decryptor returns null
    const decrypted = decryptChromiumValue(encrypted, key)
    expect(decrypted).toBeNull()
  })

  it('round-trips with multibyte UTF-8 characters', () => {
    const password = 'pw'
    const key = deriveKey(password)
    const plaintext = '你好世界🍪'

    const encrypted = encryptChromiumValue(plaintext, key)
    const decrypted = decryptChromiumValue(encrypted, key)
    expect(decrypted).toBe(plaintext)
  })

  it('returns plaintext unchanged when value does not start with v10', () => {
    const key = deriveKey('any-password')
    expect(decryptChromiumValue('not-encrypted', key)).toBe('not-encrypted')
  })

  it('returns null for v10 value with insufficient ciphertext length', () => {
    const key = deriveKey('any-password')
    // Base64 of just 4 bytes — too short for 3-byte prefix + 16-byte block
    const short = `v10${Buffer.from([0x01, 0x00, 0x00, 0x01]).toString('base64')}`
    expect(decryptChromiumValue(short, key)).toBeNull()
  })
})

describe('chromeTimestampToUnix', () => {
  it('returns null for timestamp 0', () => {
    expect(chromeTimestampToUnix(0)).toBeNull()
  })

  it('converts a known Chrome timestamp to Unix seconds', () => {
    // 2024-01-15 12:00:00 UTC as Unix: 1705319400
    // Chrome timestamp = (Unix seconds + 11644473600) * 1_000_000
    const unixExpected = 1_705_319_400
    const chromeTs = (unixExpected + 11644473600) * 1_000_000
    expect(chromeTimestampToUnix(chromeTs)).toBe(unixExpected)
  })

  it('handles large timestamps without floating point errors', () => {
    // Year 2030-06-01 00:00:00 UTC -> Unix approx 1748736000
    const unixExpected = 1_748_736_000
    const chromeTs = (unixExpected + 11644473600) * 1_000_000
    expect(chromeTimestampToUnix(chromeTs)).toBe(unixExpected)
  })
})
