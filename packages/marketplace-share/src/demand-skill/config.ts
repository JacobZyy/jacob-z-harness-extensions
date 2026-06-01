import type { DemandConfig } from './types'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname } from 'node:path'
import process from 'node:process'

const DEFAULT_TAPD_API_BASE = 'http://api.zhuaninc.com/api/tapd_open_api'

const DEFAULT_CONFIG_PATH = (): string => `${homedir()}/.config/demand-skill/config.json`

export function loadConfig(): DemandConfig {
  return {
    tapdApiBase: process.env.DEMAND_TAPD_API_BASE || DEFAULT_TAPD_API_BASE,
    configPath: process.env.DEMAND_CONFIG_PATH || DEFAULT_CONFIG_PATH(),
  }
}

export function loadConfigFile(path: string): Record<string, string> {
  if (!existsSync(path))
    return {}
  try {
    const raw = readFileSync(path, 'utf-8')
    return JSON.parse(raw) as Record<string, string>
  }
  catch {
    return {}
  }
}

export function saveConfigFile(path: string, data: Record<string, string>): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(data, null, 2))
}
