import type { LinterName } from './types'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'

import { dirname, join, resolve } from 'node:path'
import { HARNESS_CONFIG_FIELD, PROJECT_CONFIG_RELATIVE } from './config'

/** Packages whose presence implies an eslint-based project. */
const ESLINT_CONFIG_PACKAGES = ['@zz-yp/nlab_eslint_config', '@antfu/eslint-config']

/** Read all dependency names from `<cwd>/package.json`. */
function readDependencyNames(cwd: string): string[] {
  const pkgPath = join(cwd, 'package.json')
  if (!existsSync(pkgPath))
    return []

  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as Record<string, unknown>
    const collect = (field: unknown): string[] =>
      field && typeof field === 'object' ? Object.keys(field as Record<string, unknown>) : []

    return [
      ...collect(pkg.dependencies),
      ...collect(pkg.devDependencies),
      ...collect(pkg.peerDependencies),
      ...collect(pkg.optionalDependencies),
    ]
  }
  catch {
    return []
  }
}

/**
 * Sniff the repo's dependencies and decide the linter, walking up from `cwd`
 * through every ancestor's `package.json` (monorepo-aware).
 *
 * Returns `'eslint'` when `@zz-yp/nlab_eslint_config` or `@antfu/eslint-config`
 * is found in any reachable `package.json` along the chain; otherwise
 * `undefined`.
 */
export function detectLinter(cwd: string): LinterName | undefined {
  let dir = resolve(cwd)
  while (true) {
    const deps = readDependencyNames(dir)
    if (deps.some(name => ESLINT_CONFIG_PACKAGES.includes(name)))
      return 'eslint'

    const parent = dirname(dir)
    if (parent === dir)
      break
    dir = parent
  }
  return undefined
}

export interface ProbeResult {
  linter: LinterName
  /** Whether the project config file was actually written/updated. */
  written: boolean
}

/**
 * Ensure `<dir>/.gitignore` contains `entry` (appends it if missing). Existing
 * content is preserved; trailing-slash variants count as a match.
 */
function ensureGitignoreEntry(dir: string, entry: string): void {
  const gitignorePath = join(dir, '.gitignore')
  let content = ''
  if (existsSync(gitignorePath))
    content = readFileSync(gitignorePath, 'utf8')

  // Strip trailing `/*` or `/` so `.jacob-z`, `.jacob-z/`, `.jacob-z/*` all
  // count as an existing entry and are not duplicated.
  const normalize = (line: string): string =>
    line.trim().replace(/\/\*$/, '').replace(/\/$/, '')
  const base = normalize(entry)
  const has = content.split('\n').some(line => normalize(line) === base)
  if (has)
    return

  const addition = content.length === 0 ? `${entry}\n` : `${content.trimEnd()}\n${entry}\n`
  writeFileSync(gitignorePath, addition)
}

/**
 * Probe the repo and, when an eslint config package is present, inject
 * `linter: "eslint"` into the project-level harness config
 * (`<cwd>/.jacob-z/jacob-z-harness-opencode.json`).
 *
 * Existing fields are preserved. A pre-existing explicit `linter` is **not**
 * overwritten (the user's explicit choice wins), so the first run auto-injects
 * and later runs are idempotent.
 *
 * When the effective linter is `eslint`, the function also auto-detects
 * `node_modules/.bin/eslint` and injects `eslint.bin` so the adapter doesn't
 * rely on a global `eslint` in `$PATH`. This enrichment is idempotent — a
 * pre-existing explicit `eslint.bin` is never overwritten.
 *
 * Returns `undefined` when no eslint config package is detected.
 */
export function probeAndInject(cwd: string): ProbeResult | undefined {
  const linter = detectLinter(cwd)
  if (!linter)
    return undefined

  // This repo uses an eslint config package → ensure the harness config
  // directory is git-ignored whether or not we inject on this run.
  ensureGitignoreEntry(cwd, '.jacob-z/*')

  const configPath = join(cwd, PROJECT_CONFIG_RELATIVE)

  let config: Record<string, unknown> = {}
  if (existsSync(configPath)) {
    try {
      const parsed = JSON.parse(readFileSync(configPath, 'utf8'))
      if (parsed && typeof parsed === 'object')
        config = parsed as Record<string, unknown>
    }
    catch {
      // corrupt config file → start fresh
    }
  }

  const rawField = config[HARNESS_CONFIG_FIELD]
  const field
    = rawField && typeof rawField === 'object' ? (rawField as Record<string, unknown>) : {}

  // Effective linter: respect existing explicit choice, otherwise use detected.
  const effectiveLinter = (field.linter ?? linter) as LinterName

  let changed = false
  const updatedField: Record<string, unknown> = { ...field }

  // Inject linter if not yet set.
  if (field.linter === undefined) {
    updatedField.linter = effectiveLinter
    changed = true
  }

  // When using eslint, auto-detect local binary so the adapter doesn't
  // depend on a global `eslint` in `$PATH`.
  if (effectiveLinter === 'eslint') {
    const localEslintBin = join(cwd, 'node_modules', '.bin', 'eslint')
    if (existsSync(localEslintBin)) {
      const existingEslint = updatedField.eslint
      const eslintObj
        = existingEslint && typeof existingEslint === 'object'
          ? { ...(existingEslint as Record<string, unknown>) }
          : {}
      if (!eslintObj.bin) {
        eslintObj.bin = './node_modules/.bin/eslint'
        updatedField.eslint = eslintObj
        changed = true
      }
    }
  }

  if (!changed)
    return { linter: effectiveLinter, written: false }

  config[HARNESS_CONFIG_FIELD] = updatedField
  mkdirSync(join(cwd, '.jacob-z'), { recursive: true })
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`)

  return { linter: effectiveLinter, written: true }
}
