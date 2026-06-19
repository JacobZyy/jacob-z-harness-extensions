import type {
  EslinterConfig,
  LinterName,
  NormalizedEslinter,
  NormalizedOptions,
  NormalizedOxfmt,
  NormalizedOxlinter,
  OxcLintMode,
  OxfmtConfig,
  OxlinterConfig,
} from './types'
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

const MODE_VALUES: ReadonlySet<string> = new Set(['fix', 'notify', 'silent'])
const LINTER_VALUES: ReadonlySet<string> = new Set(['oxlint', 'eslint'])

function isOxcLintMode(value: unknown): value is OxcLintMode {
  return typeof value === 'string' && MODE_VALUES.has(value)
}

function isLinterName(value: unknown): value is LinterName {
  return typeof value === 'string' && LINTER_VALUES.has(value)
}

// ---------------------------------------------------------------------------
// Input options (grouped per linter)
// ---------------------------------------------------------------------------

export interface OxcLintOptions {
  linter?: LinterName
  extensions?: string[]
  maxLines?: number
  log?: boolean
  logPath?: string
  maxHints?: number
  mode?: OxcLintMode
  ignore?: string[]
  oxlint?: OxlinterConfig
  eslint?: EslinterConfig
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isOxfmtConfig(value: unknown): value is OxfmtConfig {
  if (!isRecord(value))
    return false
  return (
    (value.bin === undefined || typeof value.bin === 'string')
    && (value.configPath === undefined || typeof value.configPath === 'string')
    && (value.disableNestedConfig === undefined || typeof value.disableNestedConfig === 'boolean')
  )
}

function isOxlinterConfig(value: unknown): value is OxlinterConfig {
  if (!isRecord(value))
    return false
  return (
    (value.bin === undefined || typeof value.bin === 'string')
    && (value.configPath === undefined || typeof value.configPath === 'string')
    && (value.disableNestedConfig === undefined || typeof value.disableNestedConfig === 'boolean')
    && (value.oxfmt === undefined || isOxfmtConfig(value.oxfmt))
  )
}

function isEslinterConfig(value: unknown): value is EslinterConfig {
  if (!isRecord(value))
    return false
  return (
    (value.bin === undefined || typeof value.bin === 'string')
    && (value.configPath === undefined || typeof value.configPath === 'string')
  )
}

function isOxcLintOptions(value: unknown): value is OxcLintOptions {
  if (!isRecord(value))
    return false

  return (
    (value.linter === undefined || isLinterName(value.linter))
    && (value.extensions === undefined || isStringArray(value.extensions))
    && (value.maxLines === undefined || typeof value.maxLines === 'number')
    && (value.log === undefined || typeof value.log === 'boolean')
    && (value.logPath === undefined || typeof value.logPath === 'string')
    && (value.maxHints === undefined || typeof value.maxHints === 'number')
    && (value.mode === undefined || isOxcLintMode(value.mode))
    && (value.ignore === undefined || isStringArray(value.ignore))
    && (value.oxlint === undefined || isOxlinterConfig(value.oxlint))
    && (value.eslint === undefined || isEslinterConfig(value.eslint))
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

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

function normalizeOxfmt(oxfmt: OxfmtConfig | undefined): NormalizedOxfmt {
  return {
    bin: oxfmt?.bin ?? 'oxfmt',
    configPath: oxfmt?.configPath,
    disableNestedConfig: oxfmt?.disableNestedConfig ?? false,
  }
}

function normalizeOxlinter(oxlint: OxlinterConfig | undefined): NormalizedOxlinter {
  return {
    bin: oxlint?.bin ?? 'oxlint',
    configPath: oxlint?.configPath,
    disableNestedConfig: oxlint?.disableNestedConfig ?? false,
    oxfmt: normalizeOxfmt(oxlint?.oxfmt),
  }
}

function normalizeEslinter(eslint: EslinterConfig | undefined): NormalizedEslinter {
  return {
    bin: eslint?.bin ?? 'eslint',
    configPath: eslint?.configPath,
  }
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
    linter: mergedOptions.linter ?? 'oxlint',
    extensions: mergedOptions.extensions ?? DEFAULT_EXTENSIONS,
    maxLines: mergedOptions.maxLines ?? 2000,
    log: mergedOptions.log ?? true,
    logPath: mergedOptions.logPath ?? '~/.local/state/opencode-oxc-lint/opencode-oxc-lint.log',
    maxHints: mergedOptions.maxHints ?? 3,
    mode: mergedOptions.mode ?? 'fix',
    ignore,
    oxlint: normalizeOxlinter(mergedOptions.oxlint),
    eslint: normalizeEslinter(mergedOptions.eslint),
  }
}

export const __test__ = { isOxcLintOptions, readHarnessOptions }
