import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

export const DEFAULT_EXTENSIONS = [
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.vue',
  '.mjs',
  '.cjs',
  '.mts',
  '.cts',
]
export const HARNESS_CONFIG_PATH = '~/.config/opencode/jacob-z-harness-opencode.json'
export const HARNESS_CONFIG_FIELD = 'oxc-lint'
export const PROJECT_CONFIG_RELATIVE = join('.jacob-z', 'jacob-z-harness-opencode.json')

export type OxcLintMode = 'fix' | 'notify' | 'silent'

const MODE_VALUES: ReadonlySet<string> = new Set(['fix', 'notify', 'silent'])

function isOxcLintMode(value: unknown): value is OxcLintMode {
  return typeof value === 'string' && MODE_VALUES.has(value)
}

export interface OxcLintOptions {
  oxlintBin?: string
  configPath?: string
  disableNestedConfig?: boolean
  oxfmtBin?: string
  oxfmtConfigPath?: string
  oxfmtDisableNestedConfig?: boolean
  extensions?: string[]
  maxLines?: number
  log?: boolean
  logPath?: string
  maxHints?: number
  mode?: OxcLintMode
  ignore?: string[]
}

export interface NormalizedOptions {
  oxlintBin: string
  configPath: string | undefined
  disableNestedConfig: boolean
  oxfmtBin: string
  oxfmtConfigPath: string | undefined
  oxfmtDisableNestedConfig: boolean
  extensions: string[]
  maxLines: number
  log: boolean
  logPath: string
  maxHints: number
  mode: OxcLintMode
  ignore: string[]
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isOxcLintOptions(value: unknown): value is OxcLintOptions {
  if (!isRecord(value))
    return false

  return (
    (value.oxlintBin === undefined || typeof value.oxlintBin === 'string')
    && (value.configPath === undefined || typeof value.configPath === 'string')
    && (value.disableNestedConfig === undefined || typeof value.disableNestedConfig === 'boolean')
    && (value.oxfmtBin === undefined || typeof value.oxfmtBin === 'string')
    && (value.oxfmtConfigPath === undefined || typeof value.oxfmtConfigPath === 'string')
    && (value.oxfmtDisableNestedConfig === undefined
      || typeof value.oxfmtDisableNestedConfig === 'boolean')
    && (value.extensions === undefined || isStringArray(value.extensions))
    && (value.maxLines === undefined || typeof value.maxLines === 'number')
    && (value.log === undefined || typeof value.log === 'boolean')
    && (value.logPath === undefined || typeof value.logPath === 'string')
    && (value.maxHints === undefined || typeof value.maxHints === 'number')
    && (value.mode === undefined || isOxcLintMode(value.mode))
    && (value.ignore === undefined || isStringArray(value.ignore))
  )
}

function readHarnessOptions(configPath = HARNESS_CONFIG_PATH, home = homedir()): OxcLintOptions {
  const resolvedConfigPath = expandHome(configPath, home)
  if (!resolvedConfigPath || !existsSync(resolvedConfigPath))
    return {}

  try {
    const parsed: unknown = JSON.parse(readFileSync(resolvedConfigPath, 'utf8'))
    if (!isRecord(parsed))
      return {}

    const field = parsed[HARNESS_CONFIG_FIELD]
    return isOxcLintOptions(field) ? field : {}
  }
  catch {
    return {}
  }
}

export function expandHome(value: string | undefined, home = homedir()): string | undefined {
  if (!value)
    return undefined

  if (value === '~')
    return home

  if (value.startsWith('~/'))
    return join(home, value.slice(2))

  return value
}

export function normalizeOptions(
  options: OxcLintOptions = {},
  cwd: string = process.cwd(),
): NormalizedOptions {
  const userOptions = readHarnessOptions(HARNESS_CONFIG_PATH)
  const projectOptions = readHarnessOptions(join(cwd, PROJECT_CONFIG_RELATIVE))
  const mergedOptions: OxcLintOptions = { ...userOptions, ...projectOptions, ...options }

  // ignore 数组取并集（user ∪ project ∪ inline）
  const ignore = [
    ...(userOptions.ignore ?? []),
    ...(projectOptions.ignore ?? []),
    ...(options.ignore ?? []),
  ]

  return {
    oxlintBin: mergedOptions.oxlintBin ?? 'oxlint',
    configPath: mergedOptions.configPath,
    disableNestedConfig: mergedOptions.disableNestedConfig ?? false,
    oxfmtBin: mergedOptions.oxfmtBin ?? 'oxfmt',
    oxfmtConfigPath: mergedOptions.oxfmtConfigPath,
    oxfmtDisableNestedConfig: mergedOptions.oxfmtDisableNestedConfig ?? false,
    extensions: mergedOptions.extensions ?? DEFAULT_EXTENSIONS,
    maxLines: mergedOptions.maxLines ?? 2000,
    log: mergedOptions.log ?? true,
    logPath: mergedOptions.logPath ?? '~/.local/state/opencode-oxc-lint/opencode-oxc-lint.log',
    maxHints: mergedOptions.maxHints ?? 3,
    mode: mergedOptions.mode ?? 'fix',
    ignore,
  }
}

export const __test__ = { isOxcLintOptions, readHarnessOptions }
