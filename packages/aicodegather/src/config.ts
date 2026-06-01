import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { createLogger } from './logger'

const log = createLogger('config')

export const VERSION = 'aicodegather-omp@1.6.0'

/** Runtime config loaded from ~/.config/aicodegather.json */
export interface AicodegatherConfig {
  reportUrl?: string
  sessionUrl?: string
}

const CONFIG_PATH = join(homedir(), '.config', 'aicodegather.json')

let _cachedConfig: AicodegatherConfig | null = null

/** Read and cache the external config file. Missing file is not an error. */
export function loadConfig(): AicodegatherConfig {
  if (_cachedConfig)
    return _cachedConfig

  try {
    if (!existsSync(CONFIG_PATH)) {
      log.info(`config file not found: ${CONFIG_PATH}`)
      _cachedConfig = {}
      return _cachedConfig
    }
    const raw = readFileSync(CONFIG_PATH, 'utf-8')
    _cachedConfig = JSON.parse(raw) as AicodegatherConfig
    log.info(`loaded config from ${CONFIG_PATH}`)
  }
  catch (e) {
    log.warn(`failed to load config: ${e instanceof Error ? e.message : String(e)}`)
    _cachedConfig = {}
  }
  return _cachedConfig
}

/** Get the report URL, or empty string if unconfigured. */
export function getReportUrl(): string {
  return loadConfig().reportUrl ?? ''
}

/** Get the session report URL, or empty string if unconfigured. */
export function getSessionUrl(): string {
  return loadConfig().sessionUrl ?? ''
}

export const REQUEST_TIMEOUT_MS = 10_000
export const MAX_RETRIES = 5
export const RETRY_INTERVAL_MS = 10_000
