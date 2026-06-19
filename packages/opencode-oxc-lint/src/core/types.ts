/**
 * Core type definitions shared by the base layer and all tool adapters.
 *
 * The base layer is linter-agnostic: it only knows about the `LinterAdapter`
 * interface. Each adapter (oxlint, eslint, …) implements that interface and is
 * registered in `src/index.ts`. The base selects an adapter at runtime via the
 * `linter` config field — this is the "base + tool-plugin" split.
 */

// ---------------------------------------------------------------------------
// Command execution
// ---------------------------------------------------------------------------

export interface CommandResult {
  exitCode: number
  stdout: string
  stderr: string
}

export type CommandRunner = (
  bin: string,
  args: string[],
  env?: Record<string, string>,
) => Promise<CommandResult>

// ---------------------------------------------------------------------------
// Surfacing mode + linter selection
// ---------------------------------------------------------------------------

export type OxcLintMode = 'fix' | 'notify' | 'silent'

export type LinterName = 'oxlint' | 'eslint'

// ---------------------------------------------------------------------------
// Loop-prevention fingerprint
// ---------------------------------------------------------------------------

export interface HintState {
  /** djb2 hash of the stabilized diagnostics text for one file. */
  fingerprint: number
  /** How many times the same fingerprint has been injected. */
  count: number
}

// ---------------------------------------------------------------------------
// Adapter result shapes
// ---------------------------------------------------------------------------

export interface LintDiagnostics {
  /** Remaining diagnostics after fix + check. Absent ⇒ file is clean. */
  message?: string
  fixExitCode: number
  checkExitCode?: number
}

export interface FormatResult {
  /** Whether formatting succeeded without errors. */
  formatted: boolean
  /** Whether the file was actually changed. */
  changed: boolean
  /** CLI output. */
  output: string
}

export interface AdapterDeps {
  runner?: CommandRunner
  /** oxlint adapter: override the oxfmt binary availability check (tests). */
  oxfmtAvailable?: (bin: string) => boolean
}

// ---------------------------------------------------------------------------
// Linter adapter contract
// ---------------------------------------------------------------------------

/**
 * A pluggable linter. `format` is optional and bound to the linter: the oxlint
 * adapter ships oxfmt, the eslint adapter has none (formatter ↔ linter tied).
 *
 * The `lint` step must return a **stabilized** `message` — linter-specific
 * noise (e.g. oxlint run-timing summaries) must be stripped here so the core
 * fingerprint hash stays stable across runs without knowing linter details.
 */
export interface LinterAdapter {
  readonly name: LinterName
  /** Optional formatter bound to this linter (oxlint → oxfmt). */
  format?: (filePath: string, options: NormalizedOptions, deps?: AdapterDeps) => Promise<FormatResult>
  /** Run `--fix` then a check pass; return remaining stabilized diagnostics. */
  lint: (filePath: string, options: NormalizedOptions, deps?: AdapterDeps) => Promise<LintDiagnostics>
}

// ---------------------------------------------------------------------------
// Config value (input) shapes — grouped per linter
// ---------------------------------------------------------------------------

export interface OxfmtConfig {
  bin?: string
  configPath?: string
  disableNestedConfig?: boolean
}

export interface OxlinterConfig {
  bin?: string
  configPath?: string
  disableNestedConfig?: boolean
  /** oxfmt is nested under oxlint (formatter bound to the linter). */
  oxfmt?: OxfmtConfig
}

export interface EslinterConfig {
  bin?: string
  /** Passed as `-c <path>` (legacy eslintrc) or as a flat-config hint. */
  configPath?: string
}

// ---------------------------------------------------------------------------
// Normalized (resolved) shapes
// ---------------------------------------------------------------------------

export interface NormalizedOxfmt {
  bin: string
  configPath: string | undefined
  disableNestedConfig: boolean
}

export interface NormalizedOxlinter {
  bin: string
  configPath: string | undefined
  disableNestedConfig: boolean
  oxfmt: NormalizedOxfmt
}

export interface NormalizedEslinter {
  bin: string
  configPath: string | undefined
}

export interface NormalizedOptions {
  linter: LinterName
  extensions: string[]
  maxLines: number
  log: boolean
  logPath: string
  maxHints: number
  mode: OxcLintMode
  ignore: string[]
  oxlint: NormalizedOxlinter
  eslint: NormalizedEslinter
}

// ---------------------------------------------------------------------------
// Linter auto-detection (probe) contract.
//
// Implemented in `src/core/probe.ts`: `detectLinter(cwd)` inspects
// `<cwd>/package.json` for eslint config packages and `probeAndInject(cwd)`
// persists the chosen `linter` into the project harness config. This interface
// is the abstract contract those functions satisfy.
// ---------------------------------------------------------------------------

export interface LinterProbe {
  /** Inspect `cwd` and return the linter to use, or undefined if unknown. */
  detect: (cwd: string) => LinterName | undefined
}
