# opencode-oxc-lint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an OpenCode plugin that runs `oxlint --fix` after file-edit tools, then reports remaining `oxlint` diagnostics back to the agent.

**Architecture:** Replace the template example with a focused OpenCode plugin using `tool.execute.after`. Split implementation into small modules for config normalization, changed-file resolution, oxlint command execution, logging, and plugin hook orchestration.

**Tech Stack:** TypeScript, Bun runtime, `@opencode-ai/plugin`, Vitest, root `@antfu/eslint-config`.

---

## File Structure

- Modify: `packages/opencode-oxc-lint/package.json` — publish metadata and `@opencode-ai/plugin` version.
- Delete: `packages/opencode-oxc-lint/src/command/explain.md`
- Delete: `packages/opencode-oxc-lint/src/command/format-check.md`
- Delete: `packages/opencode-oxc-lint/src/command/hello.md`
- Delete: `packages/opencode-oxc-lint/src/command/quick-review.md`
- Modify: `packages/opencode-oxc-lint/src/index.ts` — OpenCode plugin hook only.
- Create: `packages/opencode-oxc-lint/src/config.ts` — option defaults, path expansion, config validation.
- Create: `packages/opencode-oxc-lint/src/resolve.ts` — tool arg parsing, extension filtering, line-count boundary.
- Create: `packages/opencode-oxc-lint/src/oxlint.ts` — argument construction and per-file fix/check flow.
- Create: `packages/opencode-oxc-lint/src/log.ts` — local summary logging.
- Create: `packages/opencode-oxc-lint/src/output.ts` — agent-visible output delimiters.
- Create: `packages/opencode-oxc-lint/src/config.test.ts`
- Create: `packages/opencode-oxc-lint/src/resolve.test.ts`
- Create: `packages/opencode-oxc-lint/src/oxlint.test.ts`
- Create: `packages/opencode-oxc-lint/src/index.test.ts`
- Modify: `packages/opencode-oxc-lint/README.md` — public usage and configuration.

## Task 1: Package Metadata And Template Removal

**Files:**

- Modify: `packages/opencode-oxc-lint/package.json`
- Delete: `packages/opencode-oxc-lint/src/command/explain.md`
- Delete: `packages/opencode-oxc-lint/src/command/format-check.md`
- Delete: `packages/opencode-oxc-lint/src/command/hello.md`
- Delete: `packages/opencode-oxc-lint/src/command/quick-review.md`

- [ ] **Step 1: Update package metadata**

Replace `packages/opencode-oxc-lint/package.json` with:

```json
{
  "name": "opencode-oxc-lint",
  "version": "0.1.0",
  "description": "Run oxlint CLI after edit/write/apply_patch in opencode",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "publishConfig": {
    "access": "public",
    "provenance": true
  },
  "files": [
    "dist"
  ],
  "dependencies": {
    "@opencode-ai/plugin": "^1.17.0"
  },
  "devDependencies": {
    "@types/node": "^20.11.5"
  }
}
```

- [ ] **Step 2: Remove template command files**

Delete the files under `packages/opencode-oxc-lint/src/command/`. Remove the empty `src/command` directory after deletion.

- [ ] **Step 3: Install dependencies**

Run from repo root:

```bash
bun install
```

Expected: `bun.lock` updates `@opencode-ai/plugin` to a version compatible with `tool.execute.after`.

- [ ] **Step 4: Commit**

```bash
git add packages/opencode-oxc-lint/package.json packages/opencode-oxc-lint/src/command bun.lock
git commit -m "chore(opencode-oxc-lint): remove template scaffolding"
```

## Task 2: Configuration Module

**Files:**

- Create: `packages/opencode-oxc-lint/src/config.ts`
- Create: `packages/opencode-oxc-lint/src/config.test.ts`

- [ ] **Step 1: Write failing config tests**

Create `packages/opencode-oxc-lint/src/config.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { DEFAULT_EXTENSIONS, expandHome, normalizeOptions } from './config'

describe('config', () => {
  it('uses generic defaults without personal paths', () => {
    const options = normalizeOptions()

    expect(options.oxlintBin).toBe('oxlint')
    expect(options.configPath).toBeUndefined()
    expect(options.disableNestedConfig).toBe(false)
    expect(options.extensions).toEqual(DEFAULT_EXTENSIONS)
    expect(options.maxLines).toBe(2000)
    expect(options.log).toBe(true)
    expect(options.logPath).toBe('~/.local/state/opencode-oxc-lint/opencode-oxc-lint.log')
  })

  it('overrides defaults from plugin options', () => {
    const options = normalizeOptions({
      oxlintBin: '~/bin/oxlint',
      configPath: './.oxlintrc.json',
      disableNestedConfig: true,
      extensions: ['.ts'],
      maxLines: 500,
      log: false,
      logPath: './lint.log',
    })

    expect(options.oxlintBin).toBe('~/bin/oxlint')
    expect(options.configPath).toBe('./.oxlintrc.json')
    expect(options.disableNestedConfig).toBe(true)
    expect(options.extensions).toEqual(['.ts'])
    expect(options.maxLines).toBe(500)
    expect(options.log).toBe(false)
    expect(options.logPath).toBe('./lint.log')
  })

  it('expands a leading home marker only', () => {
    const home = '/tmp/home'

    expect(expandHome('~/bin/oxlint', home)).toBe('/tmp/home/bin/oxlint')
    expect(expandHome('project/~/file', home)).toBe('project/~/file')
    expect(expandHome(undefined, home)).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run config tests and verify failure**

```bash
bunx vitest run packages/opencode-oxc-lint/src/config.test.ts
```

Expected: FAIL because `src/config.ts` does not exist.

- [ ] **Step 3: Implement config module**

Create `packages/opencode-oxc-lint/src/config.ts`:

```ts
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
```

- [ ] **Step 4: Run config tests and verify pass**

```bash
bunx vitest run packages/opencode-oxc-lint/src/config.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/opencode-oxc-lint/src/config.ts packages/opencode-oxc-lint/src/config.test.ts
git commit -m "feat(opencode-oxc-lint): add plugin options"
```

## Task 3: File Resolution Module

**Files:**

- Create: `packages/opencode-oxc-lint/src/resolve.ts`
- Create: `packages/opencode-oxc-lint/src/resolve.test.ts`

- [ ] **Step 1: Write failing resolve tests**

Create `packages/opencode-oxc-lint/src/resolve.test.ts`:

```ts
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { countLines, extractToolPaths, filterLintableFiles } from './resolve'

describe('resolve', () => {
  let dir: string

  beforeEach(() => {
    dir = join(tmpdir(), `opencode-oxc-lint-${Date.now()}-${Math.random().toString(16).slice(2)}`)
    mkdirSync(dir, { recursive: true })
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('extracts write and edit paths from args', () => {
    expect(extractToolPaths('write', { filePath: 'src/a.ts' })).toEqual(['src/a.ts'])
    expect(extractToolPaths('edit', { path: 'src/b.ts' })).toEqual(['src/b.ts'])
  })

  it('extracts apply_patch paths from patch text', () => {
    const patch = `*** Begin Patch
*** Add File: src/new.ts
+export const a = 1
*** Update File: src/existing.ts
@@
-old
+new
*** Delete File: src/deleted.ts
*** End Patch`

    expect(extractToolPaths('apply_patch', { patchText: patch })).toEqual([
      'src/new.ts',
      'src/existing.ts',
      'src/deleted.ts',
    ])
  })

  it('returns no paths for unknown tools', () => {
    expect(extractToolPaths('bash', { command: 'touch src/a.ts' })).toEqual([])
  })

  it('counts lines', () => {
    const file = join(dir, 'sample.ts')
    writeFileSync(file, 'a\nb\nc\n')

    expect(countLines(file)).toBe(3)
  })

  it('filters existing supported files under max line count', () => {
    const small = join(dir, 'small.ts')
    const large = join(dir, 'large.ts')
    const markdown = join(dir, 'note.md')

    writeFileSync(small, 'export const a = 1\n')
    writeFileSync(large, `${Array.from({ length: 2001 }, () => 'x').join('\n')}\n`)
    writeFileSync(markdown, '# note\n')

    const files = filterLintableFiles([small, large, markdown, join(dir, 'missing.ts')], {
      cwd: dir,
      extensions: ['.ts'],
      maxLines: 2000,
    })

    expect(files).toEqual([small])
  })
})
```

- [ ] **Step 2: Run resolve tests and verify failure**

```bash
bunx vitest run packages/opencode-oxc-lint/src/resolve.test.ts
```

Expected: FAIL because `src/resolve.ts` does not exist.

- [ ] **Step 3: Implement resolve module**

Create `packages/opencode-oxc-lint/src/resolve.ts`:

```ts
import { existsSync, readFileSync } from 'node:fs'
import { extname, isAbsolute, join } from 'node:path'

interface FilterOptions {
  cwd: string
  extensions: string[]
  maxLines: number
}

function getStringField(args: Record<string, unknown>, key: string): string | undefined {
  const value = args[key]
  return typeof value === 'string' ? value : undefined
}

export function extractToolPaths(tool: string, args: Record<string, unknown>): string[] {
  if (tool === 'write' || tool === 'edit') {
    const path = getStringField(args, 'filePath') ?? getStringField(args, 'path')
    return path ? [path] : []
  }

  if (tool !== 'apply_patch')
    return []

  const patchText = getStringField(args, 'patchText') ?? getStringField(args, 'patch')
  if (!patchText)
    return []

  const paths: string[] = []
  for (const line of patchText.split('\n')) {
    const match = line.match(/^\*\*\* (?:Add File|Update File|Delete File|Move to):\s+(.+)$/)
    if (match?.[1])
      paths.push(match[1].trim())
  }
  return Array.from(new Set(paths))
}

export function countLines(filePath: string): number {
  const content = readFileSync(filePath, 'utf8')
  if (content.length === 0)
    return 0

  return content.endsWith('\n') ? content.split('\n').length - 1 : content.split('\n').length
}

export function filterLintableFiles(paths: string[], options: FilterOptions): string[] {
  const result: string[] = []

  for (const path of paths) {
    const absolute = isAbsolute(path) ? path : join(options.cwd, path)
    if (!existsSync(absolute))
      continue

    if (!options.extensions.includes(extname(absolute)))
      continue

    if (countLines(absolute) > options.maxLines)
      continue

    result.push(absolute)
  }

  return Array.from(new Set(result))
}
```

- [ ] **Step 4: Run resolve tests and verify pass**

```bash
bunx vitest run packages/opencode-oxc-lint/src/resolve.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/opencode-oxc-lint/src/resolve.ts packages/opencode-oxc-lint/src/resolve.test.ts
git commit -m "feat(opencode-oxc-lint): resolve changed files"
```

## Task 4: Logging And Agent Output Helpers

**Files:**

- Create: `packages/opencode-oxc-lint/src/log.ts`
- Create: `packages/opencode-oxc-lint/src/output.ts`

- [ ] **Step 1: Implement log helper**

Create `packages/opencode-oxc-lint/src/log.ts`:

```ts
import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { expandHome } from './config'

export interface LogEntry {
  sessionID?: string
  tool?: string
  file?: string
  action: 'skip' | 'fix' | 'check' | 'error'
  exitCode?: number
  summary: string
}

export function writeLocalLog(logPath: string, entry: LogEntry): void {
  const expanded = expandHome(logPath)
  if (!expanded)
    return

  const line = JSON.stringify({
    time: new Date().toISOString(),
    ...entry,
  })

  mkdirSync(dirname(expanded), { recursive: true })
  appendFileSync(expanded, `${line}\n`)
}
```

- [ ] **Step 2: Implement output helper**

Create `packages/opencode-oxc-lint/src/output.ts`:

```ts
const HEADER = '--- opencode-oxc-lint ---'
const FOOTER = '--- end opencode-oxc-lint ---'

export function formatAgentOutput(message: string): string {
  return `\n${HEADER}\n${message.trim()}\n${FOOTER}`
}

export function appendAgentOutput(current: string, message: string): string {
  return `${current}${formatAgentOutput(message)}`
}
```

- [ ] **Step 3: Run lint on helper files**

```bash
bun run lint:fix
```

Expected: no lint errors.

- [ ] **Step 4: Commit**

```bash
git add packages/opencode-oxc-lint/src/log.ts packages/opencode-oxc-lint/src/output.ts
git commit -m "feat(opencode-oxc-lint): add logging and output helpers"
```

## Task 5: Oxlint Runner

**Files:**

- Create: `packages/opencode-oxc-lint/src/oxlint.ts`
- Create: `packages/opencode-oxc-lint/src/oxlint.test.ts`

- [ ] **Step 1: Write failing oxlint tests**

Create `packages/opencode-oxc-lint/src/oxlint.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { NormalizedOptions } from './config'
import { buildOxlintArgs, runLintForFile } from './oxlint'

const baseOptions: NormalizedOptions = {
  oxlintBin: 'oxlint',
  configPath: undefined,
  disableNestedConfig: false,
  extensions: ['.ts'],
  maxLines: 2000,
  log: false,
  logPath: 'unused.log',
}

describe('oxlint', () => {
  it('builds fix and check arguments', () => {
    expect(buildOxlintArgs('/tmp/a.ts', baseOptions, true)).toEqual(['--fix', '/tmp/a.ts'])
    expect(buildOxlintArgs('/tmp/a.ts', baseOptions, false)).toEqual(['/tmp/a.ts'])
  })

  it('adds config and nested config flags', () => {
    const options = {
      ...baseOptions,
      configPath: './.oxlintrc.json',
      disableNestedConfig: true,
    }

    expect(buildOxlintArgs('/tmp/a.ts', options, true)).toEqual([
      '-c',
      './.oxlintrc.json',
      '--disable-nested-config',
      '--fix',
      '/tmp/a.ts',
    ])
  })

  it('returns no diagnostics when fix is clean', async () => {
    const result = await runLintForFile('/tmp/a.ts', baseOptions, async () => ({
      exitCode: 0,
      stdout: '',
      stderr: '',
    }))

    expect(result.message).toBeUndefined()
  })

  it('returns final check diagnostics after fix output', async () => {
    const calls: string[][] = []
    const result = await runLintForFile('/tmp/a.ts', baseOptions, async (_bin, args) => {
      calls.push(args)
      if (args.includes('--fix')) {
        return { exitCode: 1, stdout: 'before fix', stderr: '' }
      }
      return { exitCode: 1, stdout: 'final diagnostics', stderr: '' }
    })

    expect(calls).toHaveLength(2)
    expect(result.message).toBe('final diagnostics')
  })
})
```

- [ ] **Step 2: Run oxlint tests and verify failure**

```bash
bunx vitest run packages/opencode-oxc-lint/src/oxlint.test.ts
```

Expected: FAIL because `src/oxlint.ts` does not exist.

- [ ] **Step 3: Implement oxlint runner**

Create `packages/opencode-oxc-lint/src/oxlint.ts`:

```ts
import type { NormalizedOptions } from './config'

export interface CommandResult {
  exitCode: number
  stdout: string
  stderr: string
}

export type CommandRunner = (bin: string, args: string[]) => Promise<CommandResult>

export interface LintRunResult {
  message?: string
  fixExitCode: number
  checkExitCode?: number
}

export function buildOxlintArgs(filePath: string, options: NormalizedOptions, fix: boolean): string[] {
  const args: string[] = []

  if (options.configPath) {
    args.push('-c', options.configPath)
  }

  if (options.disableNestedConfig) {
    args.push('--disable-nested-config')
  }

  if (fix) {
    args.push('--fix')
  }

  args.push(filePath)
  return args
}

export async function bunCommandRunner(bin: string, args: string[]): Promise<CommandResult> {
  const proc = Bun.spawn([bin, ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
  })

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])

  return { exitCode, stdout, stderr }
}

function joinOutput(result: CommandResult): string {
  return [result.stdout.trim(), result.stderr.trim()].filter(Boolean).join('\n')
}

export async function runLintForFile(
  filePath: string,
  options: NormalizedOptions,
  runner: CommandRunner = bunCommandRunner,
): Promise<LintRunResult> {
  const fix = await runner(options.oxlintBin, buildOxlintArgs(filePath, options, true))
  const fixOutput = joinOutput(fix)

  if (fix.exitCode === 0 && fixOutput.length === 0) {
    return { fixExitCode: fix.exitCode }
  }

  const check = await runner(options.oxlintBin, buildOxlintArgs(filePath, options, false))
  const checkOutput = joinOutput(check)

  return {
    message: checkOutput || fixOutput,
    fixExitCode: fix.exitCode,
    checkExitCode: check.exitCode,
  }
}
```

- [ ] **Step 4: Run oxlint tests and verify pass**

```bash
bunx vitest run packages/opencode-oxc-lint/src/oxlint.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/opencode-oxc-lint/src/oxlint.ts packages/opencode-oxc-lint/src/oxlint.test.ts
git commit -m "feat(opencode-oxc-lint): run oxlint fix and check"
```

## Task 6: Plugin Hook Integration

**Files:**

- Modify: `packages/opencode-oxc-lint/src/index.ts`
- Create: `packages/opencode-oxc-lint/src/index.test.ts`

- [ ] **Step 1: Write failing integration test**

Create `packages/opencode-oxc-lint/src/index.test.ts`:

```ts
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { handleToolAfter } from './index'

describe('plugin integration', () => {
  let dir: string

  beforeEach(() => {
    dir = join(tmpdir(), `opencode-oxc-lint-plugin-${Date.now()}-${Math.random().toString(16).slice(2)}`)
    mkdirSync(dir, { recursive: true })
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('appends remaining diagnostics after a write tool', async () => {
    const file = join(dir, 'a.ts')
    writeFileSync(file, 'const a = 1\n')

    const output = { title: '', output: 'Wrote file successfully.', metadata: {} }
    await handleToolAfter(
      {
        tool: 'write',
        sessionID: 'ses_test',
        callID: 'call_test',
        args: { filePath: file },
      },
      output,
      { cwd: dir },
      {
        options: { log: false, oxlintBin: 'oxlint' },
        runner: async (_bin, args) => {
          if (args.includes('--fix'))
            return { exitCode: 1, stdout: 'fix output', stderr: '' }
          return { exitCode: 1, stdout: 'final diagnostics', stderr: '' }
        },
      },
    )

    expect(output.output).toContain('--- opencode-oxc-lint ---')
    expect(output.output).toContain('final diagnostics')
  })

  it('keeps output unchanged when fix makes file clean', async () => {
    const file = join(dir, 'a.ts')
    writeFileSync(file, 'const a = 1\n')

    const output = { title: '', output: 'Wrote file successfully.', metadata: {} }
    await handleToolAfter(
      {
        tool: 'write',
        sessionID: 'ses_test',
        callID: 'call_test',
        args: { filePath: file },
      },
      output,
      { cwd: dir },
      {
        options: { log: false, oxlintBin: 'oxlint' },
        runner: async () => ({ exitCode: 0, stdout: '', stderr: '' }),
      },
    )

    expect(output.output).toBe('Wrote file successfully.')
  })
})
```

- [ ] **Step 2: Run integration test and verify failure**

```bash
bunx vitest run packages/opencode-oxc-lint/src/index.test.ts
```

Expected: FAIL because `handleToolAfter` is not implemented.

- [ ] **Step 3: Replace template entry with plugin implementation**

Replace `packages/opencode-oxc-lint/src/index.ts` with:

```ts
import { existsSync } from 'node:fs'
import type { Plugin, PluginOptions } from '@opencode-ai/plugin'
import type { OxcLintOptions } from './config'
import type { CommandRunner } from './oxlint'
import { expandHome, normalizeOptions } from './config'
import { writeLocalLog } from './log'
import { appendAgentOutput } from './output'
import { runLintForFile } from './oxlint'
import { extractToolPaths, filterLintableFiles } from './resolve'

interface ToolAfterInput {
  tool: string
  sessionID: string
  callID: string
  args: Record<string, unknown>
}

interface ToolAfterOutput {
  title: string
  output: string
  metadata: unknown
}

interface RuntimeContext {
  cwd: string
}

interface HandlerDependencies {
  options?: OxcLintOptions
  runner?: CommandRunner
}

function toOptions(options?: PluginOptions | OxcLintOptions): OxcLintOptions {
  return (options ?? {}) as OxcLintOptions
}

function appendError(output: ToolAfterOutput, message: string): void {
  output.output = appendAgentOutput(output.output, message)
}

export async function handleToolAfter(
  input: ToolAfterInput,
  output: ToolAfterOutput,
  ctx: RuntimeContext,
  deps: HandlerDependencies = {},
): Promise<void> {
  if (!['edit', 'write', 'apply_patch'].includes(input.tool))
    return

  const options = normalizeOptions(deps.options)
  const oxlintBin = expandHome(options.oxlintBin) ?? options.oxlintBin
  const configPath = expandHome(options.configPath)
  const logPath = expandHome(options.logPath) ?? options.logPath
  const resolvedOptions = { ...options, oxlintBin, configPath, logPath }

  if (configPath && !existsSync(configPath)) {
    const message = `Configured oxlint config does not exist: ${configPath}`
    appendError(output, message)
    if (resolvedOptions.log)
      writeLocalLog(logPath, { sessionID: input.sessionID, tool: input.tool, action: 'error', summary: message })
    return
  }

  const paths = extractToolPaths(input.tool, input.args)
  const files = filterLintableFiles(paths, {
    cwd: ctx.cwd,
    extensions: resolvedOptions.extensions,
    maxLines: resolvedOptions.maxLines,
  })

  for (const file of files) {
    try {
      const result = await runLintForFile(file, resolvedOptions, deps.runner)
      if (resolvedOptions.log) {
        writeLocalLog(logPath, {
          sessionID: input.sessionID,
          tool: input.tool,
          file,
          action: result.message ? 'check' : 'fix',
          exitCode: result.checkExitCode ?? result.fixExitCode,
          summary: result.message ? 'remaining diagnostics' : 'clean after fix',
        })
      }

      if (result.message)
        output.output = appendAgentOutput(output.output, result.message)
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      appendError(output, message)
      if (resolvedOptions.log) {
        writeLocalLog(logPath, {
          sessionID: input.sessionID,
          tool: input.tool,
          file,
          action: 'error',
          summary: message,
        })
      }
      return
    }
  }
}

const plugin: Plugin = async (input, options) => {
  return {
    async 'tool.execute.after'(hookInput, output) {
      await handleToolAfter(hookInput, output, { cwd: input.directory }, { options: toOptions(options) })
    },
  }
}

export default plugin
```

- [ ] **Step 4: Run integration test and verify pass**

```bash
bunx vitest run packages/opencode-oxc-lint/src/index.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/opencode-oxc-lint/src/index.ts packages/opencode-oxc-lint/src/index.test.ts
git commit -m "feat(opencode-oxc-lint): run after opencode file edits"
```

## Task 7: README Update

**Files:**

- Modify: `packages/opencode-oxc-lint/README.md`

- [ ] **Step 1: Replace README with package-specific documentation**

Replace `packages/opencode-oxc-lint/README.md` with:

````md
# opencode-oxc-lint

OpenCode plugin that runs `oxlint` after source-file edits.

The plugin runs `oxlint --fix` first. If fixes leave diagnostics behind, it runs `oxlint` again and appends the final diagnostics to the OpenCode tool output so the agent can continue fixing them.

## Install

```bash
npm install -g opencode-oxc-lint
````

## Configure

Add the plugin to OpenCode config:

```json
{
  "plugin": [
    [
      "opencode-oxc-lint",
      {
        "oxlintBin": "oxlint",
        "configPath": "./.oxlintrc.json",
        "disableNestedConfig": false
      }
    ]
  ]
}
```

## Options

| Option                | Default                                                  | Description                              |
| --------------------- | -------------------------------------------------------- | ---------------------------------------- |
| `oxlintBin`           | `oxlint`                                                 | Binary or path used to run oxlint.       |
| `configPath`          | unset                                                    | Optional oxlint config passed with `-c`. |
| `disableNestedConfig` | `false`                                                  | Adds `--disable-nested-config`.          |
| `extensions`          | JS/TS/Vue extensions                                     | File extensions to lint.                 |
| `maxLines`            | `2000`                                                   | Skip files over this line count.         |
| `log`                 | `true`                                                   | Write local summary logs.                |
| `logPath`             | `~/.local/state/opencode-oxc-lint/opencode-oxc-lint.log` | Log destination.                         |

## Behavior

- Runs after successful `edit`, `write`, and `apply_patch` tools.
- Skips unsupported, deleted, missing, and over-large files.
- Appends output only when configuration errors or remaining diagnostics need agent attention.
- Does not run formatters; configure OpenCode formatter separately.

````

- [ ] **Step 2: Commit**

```bash
git add packages/opencode-oxc-lint/README.md
git commit -m "docs(opencode-oxc-lint): document plugin usage"
````

## Task 8: Final Verification

**Files:**

- All files changed in prior tasks.

- [ ] **Step 1: Run package tests**

```bash
bunx vitest run packages/opencode-oxc-lint/src
```

Expected: all `opencode-oxc-lint` tests pass.

- [ ] **Step 2: Run full monorepo tests**

```bash
bunx vitest run
```

Expected: all tests pass.

- [ ] **Step 3: Run lint fix**

```bash
bun run lint:fix
```

Expected: exits with code 0 and no remaining lint errors.

- [ ] **Step 4: Inspect for personal paths**

```bash
rg '[/]Users[/]|[~][.]bun|[~][.]config[/]oxc' packages/opencode-oxc-lint docs/superpowers/specs/2026-06-10-opencode-oxc-lint-design.md
```

Expected: no matches.

- [ ] **Step 5: Commit verification cleanups if lint changed files**

If `bun run lint:fix` changed files, commit only those package files:

```bash
git add packages/opencode-oxc-lint
git commit -m "style(opencode-oxc-lint): apply root lint formatting"
```

- [ ] **Step 6: Report status**

Run:

```bash
git status --short
```

Expected: no unexpected changes except user-owned untracked files that predated implementation.

## Self-Review

Spec coverage:

- OpenCode-only plugin: Task 6.
- No OMP or `oxlint-gate` coupling: Tasks 1 and 6.
- No formatter: Task 6 only calls oxlint.
- Generic defaults and configurable options: Task 2 and Task 7.
- File filtering and max line count: Task 3 and Task 6.
- `oxlint --fix` then final check output: Task 5 and Task 6.
- Operational errors reported to agent: Task 6.
- Local concise logging: Task 4 and Task 6.
- Tests and verification: Tasks 2, 3, 5, 6, and 8.

Placeholder scan: no placeholder markers or deferred sections.

Type consistency: `OxcLintOptions`, `NormalizedOptions`, `CommandRunner`, `extractToolPaths`, `filterLintableFiles`, `runLintForFile`, and `handleToolAfter` names are defined before use.
