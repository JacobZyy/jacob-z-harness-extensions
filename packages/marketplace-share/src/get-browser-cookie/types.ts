/**
 * Types for get-browser-cookie.
 */

export interface Cookie {
  name: string
  value: string
  domain: string
  path: string
}

export interface BrowserConfig {
  name: string
  keychainService: string
  keychainAccount: string
  cookieDbPath: string
}

export interface CookieResult {
  cookies: Cookie[]
  count: number
  browser: string
}
