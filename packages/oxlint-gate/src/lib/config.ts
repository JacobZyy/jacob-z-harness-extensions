import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { HOME } from './log'

export interface OxlintGateConfig {
  oxlintBin?: string
  configPath?: string
  disableNestedConfig?: boolean
  oxfmtBin?: string
  oxfmtConfigPath?: string
  oxfmtDisableNestedConfig?: boolean
}

export interface NormalizedConfig {
  oxlintBin: string
  configPath: string | undefined
  disableNestedConfig: boolean
  oxfmtBin: string
  oxfmtConfigPath: string | undefined
  oxfmtDisableNestedConfig: boolean
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
    && (value.oxfmtBin === undefined || typeof value.oxfmtBin === 'string')
    && (value.oxfmtConfigPath === undefined || typeof value.oxfmtConfigPath === 'string')
    && (value.oxfmtDisableNestedConfig === undefined || typeof value.oxfmtDisableNestedConfig === 'boolean')
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
    oxfmtBin: raw.oxfmtBin ?? 'oxfmt',
    oxfmtConfigPath: raw.oxfmtConfigPath,
    oxfmtDisableNestedConfig: raw.oxfmtDisableNestedConfig ?? false,
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
