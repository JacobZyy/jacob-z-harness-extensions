import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { HOME } from './log'

export interface OxlintGateConfig {
  oxlintBin?: string
  configPath?: string
  disableNestedConfig?: boolean
}

export interface NormalizedConfig {
  oxlintBin: string
  configPath: string | undefined
  disableNestedConfig: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isOxlintGateConfig(value: unknown): value is OxlintGateConfig {
  if (!isRecord(value))
    return false

  return (
    (value.oxlintBin === undefined || typeof value.oxlintBin === 'string')
    && (value.configPath === undefined || typeof value.configPath === 'string')
    && (value.disableNestedConfig === undefined || typeof value.disableNestedConfig === 'boolean')
  )
}

const CONFIG_PATH = join(HOME, '.omp', 'oxlint-gate.json')

function readConfigFile(): OxlintGateConfig {
  if (!existsSync(CONFIG_PATH))
    return {}

  try {
    const parsed: unknown = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'))
    return isOxlintGateConfig(parsed) ? parsed : {}
  }
  catch {
    return {}
  }
}

function normalizeOptions(raw: OxlintGateConfig): NormalizedConfig {
  return {
    oxlintBin: raw.oxlintBin ?? 'oxlint',
    configPath: raw.configPath,
    disableNestedConfig: raw.disableNestedConfig ?? false,
  }
}

let cachedConfig: NormalizedConfig | undefined

export function loadConfig(): NormalizedConfig {
  if (cachedConfig)
    return cachedConfig

  const raw = readConfigFile()
  cachedConfig = normalizeOptions(raw)
  return cachedConfig
}

export const __test__ = { isOxlintGateConfig, readConfigFile, CONFIG_PATH }
