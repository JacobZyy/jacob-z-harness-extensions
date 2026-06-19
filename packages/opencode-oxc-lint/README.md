# opencode-oxc-lint

OpenCode plugin that runs a linter (oxlint **or** eslint) after source-file edits.

The plugin is split into a **linter-agnostic base** (`src/core`) and **tool
adapters** (`src/adapters`). The base drives a shared pipeline
(format → `--fix` → check) and a fingerprint-based loop preventer; each adapter
implements a `LinterAdapter` contract. You pick the active linter through the
`linter` config field — no code changes needed.

- **oxlint** adapter runs `oxfmt` (format) → `oxlint --fix` → `oxlint`. The
  formatter (oxfmt) is bound to the linter.
- **eslint** adapter runs `eslint --fix` → `eslint` (no formatter — formatter ↔
  linter are tied).

Remaining diagnostics surface to the agent according to `mode`, tempered by
`ignore` globs and fingerprint-based loop prevention.

## Architecture

```
src/
  core/         base layer (linter-agnostic)
    types.ts        LinterAdapter contract + config types
    config.ts       two-level config merge + linter selection + probe seam
    pipeline.ts     adapter-driven pipeline (format? → fix → check)
    handler.ts      immediate-mode + idle handlers, file collector
    plugin.ts       createPlugin(adapters) — assembles the opencode plugin
    resolve.ts      file collection / filtering / ignore globs
    fingerprint.ts  djb2 diagnostics hash (pure, no linter knowledge)
    runner.ts       Bun command runner
    log.ts          local JSONL log
  adapters/     tool plugins
    oxlint.ts       oxlint adapter (+ bound oxfmt formatter)
    oxfmt.ts        oxfmt implementation (used by the oxlint adapter)
    eslint.ts       eslint adapter (no formatter)
  index.ts      adapter registry + default plugin export
```

Add a new linter by implementing `LinterAdapter` under `src/adapters/` and
registering it in `src/index.ts`; it becomes selectable via configuration alone.

## Install

```bash
npm install -g opencode-oxc-lint
```

## Configure

Add the plugin to OpenCode config:

```json
{
  "plugin": [
    [
      "opencode-oxc-lint",
      {
        "linter": "oxlint",
        "oxlint": {
          "bin": "oxlint",
          "configPath": "./.oxlintrc.json",
          "disableNestedConfig": false,
          "oxfmt": { "bin": "oxfmt", "configPath": "./.oxfmtrc.json" }
        },
        "eslint": { "bin": "eslint", "configPath": "./eslint.config.js" }
      }
    ]
  ]
}
```

Switch linters by flipping `linter` (`"oxlint"` | `"eslint"`). Each linter's
options live under its own group.

### Options

| Option                          | Default                                                  | Description                                              |
| ------------------------------- | -------------------------------------------------------- | -------------------------------------------------------- |
| `linter`                        | `oxlint`                                                 | Active linter: `oxlint` \| `eslint`.                     |
| `oxlint.bin`                    | `oxlint`                                                 | oxlint binary or path.                                   |
| `oxlint.configPath`             | unset                                                    | oxlint config passed with `-c`.                          |
| `oxlint.disableNestedConfig`    | `false`                                                  | Adds `--disable-nested-config` to oxlint.                |
| `oxlint.oxfmt.bin`              | `oxfmt`                                                  | oxfmt binary or path (formatter bound to oxlint).        |
| `oxlint.oxfmt.configPath`       | unset                                                    | oxfmt config passed with `-c`.                           |
| `oxlint.oxfmt.disableNestedConfig` | `false`                                               | Adds `--disable-nested-config` to oxfmt.                 |
| `eslint.bin`                    | `eslint`                                                 | eslint binary or path.                                   |
| `eslint.configPath`             | unset                                                    | eslint config passed with `-c` (legacy eslintrc).        |
| `extensions`                    | JS/TS/Vue extensions                                     | File extensions to lint.                                 |
| `maxLines`                      | `2000`                                                   | Skip files over this line count.                         |
| `log`                           | `true`                                                   | Write local summary logs.                                |
| `logPath`                       | `~/.local/state/opencode-oxc-lint/opencode-oxc-lint.log` | Log destination.                                         |
| `maxHints`                      | `3`                                                      | Max times identical diagnostics for one file are injected per session. |
| `mode`                          | `fix`                                                    | How diagnostics surface to the agent: `fix` \| `notify` \| `silent`. |
| `ignore`                        | `[]`                                                     | Glob patterns; matched files skip the pipeline entirely. |

### Mode

Controls how remaining diagnostics reach the agent after `format? → --fix → check`:

| mode     | Injected into tool output | Behavior                                  |
| -------- | ------------------------- | ----------------------------------------- |
| `fix`    | `[oxc-lint] <file>: ...`  | Agent is expected to act on the diagnostics. |
| `notify` | `[oxc-lint: informational, no fix needed] ...` | Visible to the agent but marked as no-fix-needed. |
| `silent` | not injected              | Logged + toasted only; agent never sees it. |

### Ignore

Glob patterns matched against the cwd-relative path (and the raw path). Matched
files skip the whole pipeline — no format, no lint, no injection, no hint
counting. Highest priority, overrides `mode`.

```json
{ "ignore": ["**/*.test.ts", "dist/**", "src/generated/**"] }
```

### Loop prevention (fingerprint dedupe)

Per file/session the plugin keeps a diagnostics fingerprint + counter. Each
adapter returns a **stabilized** message (e.g. oxlint strips run-timing summary
lines) so the fingerprint only changes when real diagnostics change:

- fingerprint **unchanged** (agent can't/won't fix) → counter rises; after
  `maxHints` repetitions the same diagnostics are no longer injected
- fingerprint **changed** (partial fix / new error) → counter resets to 1 and
  diagnostics are re-injected
- file goes **clean** → record cleared, next error starts fresh

## Two-level config

Options are merged from two sources (scalars: project > user; `ignore` arrays:
union):

| Level   | Path                                                                |
| ------- | ------------------------------------------------------------------ |
| user    | `~/.config/opencode/jacob-z-harness-opencode.json` (`oxc-lint` field) |
| project | `<cwd>/.jacob-z/jacob-z-harness-opencode.json` (`oxc-lint` field) |

## Linter auto-detection (probe)

On plugin load (session start), the plugin probes `<cwd>/package.json`. When
`@zz-yp/nlab_eslint_config` or `@antfu/eslint-config` is among the
(dev/peer/optional) dependencies, it injects `linter: "eslint"` into the
project-level config (`<cwd>/.jacob-z/jacob-z-harness-opencode.json`).

- Existing config fields are preserved.
- An explicit `linter` already present in the project config is **not**
  overwritten (your choice wins) — so the first run auto-injects and later runs
  are idempotent no-ops.
- No eslint config package detected → nothing is written.

Implemented in `src/core/probe.ts` (`detectLinter` / `probeAndInject`); wired
into `src/core/plugin.ts` at load time.

## Behavior

- Runs after successful `edit`, `write`, and `apply_patch` tools.
- Pipeline order: `adapter.format?` → `adapter.lint (--fix then check)`.
- Skips unsupported, deleted, missing, and over-large files.
- Files matching `ignore` skip the pipeline entirely.
- Appends remaining diagnostics according to `mode`.
