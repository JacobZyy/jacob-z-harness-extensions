/**
 * Detect available Chromium browsers on macOS.
 * Checks known cookie DB paths and returns configs in priority order.
 */

import type { BrowserConfig } from './types'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const BROWSER_CONFIGS: BrowserConfig[] = [
  {
    name: 'Chrome',
    keychainService: 'Chrome Safe Storage',
    keychainAccount: 'Chrome',
    cookieDbPath: '~/Library/Application Support/Google/Chrome/Default/Cookies',
  },
  {
    name: 'Edge',
    keychainService: 'Microsoft Edge Safe Storage',
    keychainAccount: 'Microsoft Edge',
    cookieDbPath: '~/Library/Application Support/Microsoft Edge/Default/Cookies',
  },
  {
    name: 'Arc',
    keychainService: 'Arc Safe Storage',
    keychainAccount: 'Arc',
    cookieDbPath: '~/Library/Application Support/Arc/User Data/Default/Cookies',
  },
  {
    name: 'Brave',
    keychainService: 'Brave Safe Storage',
    keychainAccount: 'Brave',
    cookieDbPath: '~/Library/Application Support/BraveSoftware/Brave-Browser/Default/Cookies',
  },
]

/** Expand `~` to the user's home directory. */
export function expandTilde(path: string): string {
  if (path.startsWith('~/')) {
    return join(homedir(), path.slice(2))
  }
  return path
}

/**
 * Detect which Chromium browsers are installed by checking
 * if their cookie DB file exists. Returns configs in priority order.
 */
export function detectAvailableBrowsers(): BrowserConfig[] {
  return BROWSER_CONFIGS.filter((config) => {
    const expanded = expandTilde(config.cookieDbPath)
    return existsSync(expanded)
  })
}

/** Get the first available browser config, or null if none found. */
export function detectDefaultBrowser(): BrowserConfig | null {
  const available = detectAvailableBrowsers()
  return available.length > 0 ? available[0] : null
}
