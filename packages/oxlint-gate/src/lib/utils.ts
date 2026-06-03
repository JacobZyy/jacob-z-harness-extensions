import { readFileSync, statSync } from 'node:fs'
import { isAbsolute, join, relative, resolve } from 'node:path'
import process from 'node:process'
import { HOME } from './log'

// ── Path helpers ────────────────────────────────────────────────────────

export function expandTilde(p: string): string {
  if (p === '~' || p.startsWith('~/')) {
    return join(HOME, p.slice(1))
  }
  return p
}

export function resolveFilePath(rawPath: string, cwd: string): string {
  const expanded = expandTilde(rawPath)
  return isAbsolute(expanded) ? expanded : resolve(cwd, expanded)
}

export function isExistingFile(p: string): boolean {
  try {
    return statSync(p).isFile()
  }
  catch {
    return false
  }
}

// ── File path extraction from tool input ────────────────────────────────

export function extractFilePath(input: Record<string, unknown>): string | undefined {
  // Direct `path` field (replace/patch modes of edit, and write tool)
  const directPath = input.path
  if (typeof directPath === 'string' && directPath)
    return directPath

  // Hashline / apply-patch modes: `input` is a raw string containing the path
  const rawInput = input.input
  if (typeof rawInput !== 'string' || !rawInput)
    return undefined

  // Hashline: ¶path#hash or §path#hash or @path#hash
  const hashlineMatch = /^[¶§@]([^\s#]+)/m.exec(rawInput)
  if (hashlineMatch?.[1])
    return hashlineMatch[1]

  // Apply-patch: *** Add/Update/Delete File: path
  const applyPatchMatch = /^\*\*\* (?:Add|Update|Delete) File:\s*(.+)/m.exec(rawInput)
  if (applyPatchMatch?.[1])
    return applyPatchMatch[1].trim()

  return undefined
}

// ── Glob / ignore pattern matching ──────────────────────────────────────

export interface HasIgnorePatterns {
  ignorePatterns?: string[]
}

export function loadIgnorePatterns<T extends HasIgnorePatterns>(cfgPath: string): string[] {
  try {
    const raw = readFileSync(cfgPath, 'utf8')
    const cfg = JSON.parse(raw) as T
    if (!Array.isArray(cfg.ignorePatterns))
      return []
    return cfg.ignorePatterns.filter((p): p is string => typeof p === 'string')
  }
  catch {
    return []
  }
}

export function matchesIgnorePattern(filePath: string, patterns: string[]): boolean {
  if (patterns.length === 0)
    return false

  const rel = relative(process.cwd(), filePath)
  const candidates = [filePath, rel, `./${rel}`]

  for (const pattern of patterns) {
    const regex = globToRegex(pattern)
    if (regex) {
      for (const c of candidates) {
        if (regex.test(c))
          return true
      }
    }
  }
  return false
}

function globToRegex(glob: string): RegExp | null {
  try {
    const regexStr = glob
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*/g, '{{DOUBLE_STAR}}')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '[^/]')
      .replace(/\{\{DOUBLE_STAR\}\}/g, '.*')

    return new RegExp(`^${regexStr}$`)
  }
  catch {
    return null
  }
}
