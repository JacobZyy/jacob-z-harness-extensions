import { homedir } from 'node:os'
import { join } from 'node:path'

export const DEFAULT_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.vue', '.mjs', '.cjs', '.mts', '.cts']

export interface OxcLintOptions {
  oxlintBin?: string
  configPath?: string
  disableNestedConfig?: boolean
  extensions?: string[]
  maxLines?: number
  log?: boolean
  logPath?: string
}

export interface NormalizedOptions {
  oxlintBin: string
  configPath: string | undefined
  disableNestedConfig: boolean
  extensions: string[]
  maxLines: number
  log: boolean
  logPath: string
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

export function normalizeOptions(options: OxcLintOptions = {}): NormalizedOptions {
  return {
    oxlintBin: options.oxlintBin ?? 'oxlint',
    configPath: options.configPath,
    disableNestedConfig: options.disableNestedConfig ?? false,
    extensions: options.extensions ?? DEFAULT_EXTENSIONS,
    maxLines: options.maxLines ?? 2000,
    log: options.log ?? true,
    logPath: options.logPath ?? '~/.local/state/opencode-oxc-lint/opencode-oxc-lint.log',
  }
}
