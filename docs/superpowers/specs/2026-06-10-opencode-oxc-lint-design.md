# opencode-oxc-lint Design

Date: 2026-06-10

## Goal

Build `opencode-oxc-lint` as an OpenCode plugin that runs `oxlint` after file-editing tools change source files. The plugin first applies automatic fixes, then reports remaining lint diagnostics back to the agent so the agent can continue fixing issues.

The plugin exists because OpenCode LSP diagnostics can hide actionable `oxlint` findings when the LSP reports them with warning severity. Running the `oxlint` CLI after edits bypasses that LSP severity filtering and gives the agent the final CLI diagnostics directly.

## Non-Goals

- Do not support OMP extensions.
- Do not reuse or couple to `packages/oxlint-gate`.
- Do not run `oxfmt` or other formatters. Formatting remains the responsibility of OpenCode formatter configuration.
- Do not hard-code personal paths, usernames, or local machine details in source, README defaults, or tests.

## Package Scope

`packages/opencode-oxc-lint` is an independent OpenCode plugin package in the current monorepo. It uses `@opencode-ai/plugin` and exports an OpenCode plugin entry point.

The template example command loader, sample tool, and sample slash commands should be removed. The package should contain only the plugin implementation, focused helpers, tests, and package metadata.

## Runtime Hook

The plugin registers `tool.execute.after`.

The hook handles only successful file-modification tools:

- `edit`
- `write`
- `apply_patch`

All other tools are ignored. If the tool execution failed, the plugin does not run lint.

## Configuration

Configuration is provided through OpenCode plugin options.

Default options must not contain personal paths:

```ts
interface OxcLintOptions {
  oxlintBin?: string
  configPath?: string
  disableNestedConfig?: boolean
  extensions?: string[]
  maxLines?: number
  log?: boolean
  logPath?: string
}
```

Default values:

```ts
{
  oxlintBin: 'oxlint',
  configPath: undefined,
  disableNestedConfig: false,
  extensions: ['.js', '.jsx', '.ts', '.tsx', '.vue', '.mjs', '.cjs', '.mts', '.cts'],
  maxLines: 2000,
  log: true,
  logPath: '~/.local/state/opencode-oxc-lint/opencode-oxc-lint.log',
}
```

The plugin expands `~` in option paths at runtime. Users may provide personal paths in their own OpenCode config, but the plugin source and documentation defaults must remain generic.

Example user configuration:

```json
[
  "opencode-oxc-lint",
  {
    "oxlintBin": "oxlint",
    "configPath": "./.oxlintrc.json",
    "disableNestedConfig": true
  }
]
```

## File Selection

For each handled tool call, the plugin extracts changed files from hook args or metadata.

Resolution rules:

- `write` and `edit`: resolve one target path from fields such as `filePath`, `path`, or structured metadata if available.
- `apply_patch`: resolve all affected files from structured metadata if available. If metadata is unavailable, parse patch text for file headers such as `*** Add File:`, `*** Update File:`, `*** Delete File:`, and `*** Move to:`.

After extraction, the plugin filters candidates:

- file must exist on disk
- deleted files are skipped
- extension must match configured `extensions`
- line count must be less than or equal to `maxLines`

Files over `maxLines` are skipped and recorded in the local log. They are not reported to the agent by default.

## Lint Flow

For each target file, the plugin runs per-file commands in sequence.

First command:

```bash
oxlint --fix <file>
```

The actual command includes configured arguments:

- `-c <configPath>` when `configPath` is set
- `--disable-nested-config` when enabled

If `oxlint --fix` exits with code `0` and produces no stdout or stderr, the plugin treats the file as clean and adds nothing to the agent-visible tool output.

If `oxlint --fix` produces output or exits non-zero, the plugin runs a second command:

```bash
oxlint <file>
```

Only the second command's final diagnostics are appended to the tool output. This avoids showing diagnostics that `--fix` already corrected.

If `--fix` fails because the binary cannot run or configuration is invalid, the plugin reports that operational error and does not pretend it is a normal lint diagnostic.

## Agent Output

The plugin appends output only when the agent needs to act.

Append to `output.output` when:

- `oxlintBin` is missing or not executable
- configured `configPath` does not exist
- final check still reports diagnostics
- an unexpected command error prevents linting

Do not append output when:

- the tool is unsupported
- the file is unsupported
- the file is deleted
- the file exceeds `maxLines`
- `oxlint --fix` makes the file clean

Agent-visible output should be clearly delimited, for example:

```text

--- opencode-oxc-lint ---
<diagnostics or operational error>
--- end opencode-oxc-lint ---
```

## Error Handling

Operational errors stop the current lint flow and are reported to the agent.

Rules:

- If `oxlintBin` cannot be resolved or executed, stop linting for the tool call.
- If `configPath` is configured but missing, stop linting for the tool call.
- If `configPath` is not configured, omit `-c` and let `oxlint` use its normal config discovery.
- If one file fails due to a file-specific issue, log that file and continue other files where safe.
- Do not add timeout-specific logic in the first version.
- Do not add loop guard logic in the first version.

The `maxLines` boundary is the main safety valve for oversized files. Default maximum is 2000 lines.

## Logging

The plugin writes concise local logs for traceability.

Default log path:

```text
~/.local/state/opencode-oxc-lint/opencode-oxc-lint.log
```

Each log entry includes:

- timestamp
- `sessionID`
- tool name
- file path when available
- action: `skip`, `fix`, `check`, or `error`
- exit code when available
- short summary

Logs must not include source file contents or large raw lint outputs. Logging can be disabled with `log: false`, and `logPath` can be overridden.

## Suggested Internal Modules

Keep implementation small and focused:

- `src/index.ts`: plugin entry and hook registration
- `src/config.ts`: option normalization, defaults, `~` expansion
- `src/resolve.ts`: changed-file extraction and filtering
- `src/oxlint.ts`: command construction and process execution
- `src/log.ts`: local summary logging

This split keeps OpenCode hook code separate from path parsing, command construction, and logging.

## Tests

Use Vitest from the monorepo.

Unit tests:

- `resolveTargetFiles` handles `write`, `edit`, `apply_patch`, multi-file patches, deleted files, relative paths, absolute paths, and unknown tools.
- `isSupportedFile` accepts JavaScript, TypeScript, Vue, and module variants; rejects Markdown, JSON, CSS, and unsupported files.
- `countLines` allows files with `maxLines` or fewer and skips files over the limit.
- `buildOxlintArgs` handles check and fix modes, configured `configPath`, omitted `configPath`, and `disableNestedConfig`.
- `runLintForFile` handles fix-clean, fix-then-check diagnostics, missing binary, and missing config path using mocked process results.

Integration-style tests:

- Simulate `tool.execute.after` input and verify that remaining lint diagnostics are appended to `output.output`.
- Simulate clean fix and verify that `output.output` is unchanged.

Verification commands after implementation:

```bash
bun run lint:fix
bunx vitest run
```

## Acceptance Criteria

- Package compiles and lints with the monorepo root ESLint configuration.
- No package-local ESLint, Prettier, mise, release-please, or template command scaffolding remains.
- Plugin handles `edit`, `write`, and `apply_patch` after successful execution.
- Plugin runs `oxlint --fix` first and appends only final unresolved diagnostics from a follow-up check.
- Plugin skips unsupported, missing, deleted, or over-2000-line files.
- Plugin reports missing `oxlintBin` and missing configured `configPath` to the agent.
- Plugin writes concise local logs by default.
- Source, docs, and tests contain no personal absolute paths or usernames.
