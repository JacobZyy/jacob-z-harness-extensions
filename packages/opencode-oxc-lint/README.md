# opencode-oxc-lint

OpenCode plugin that runs `oxlint` after source-file edits.

The plugin runs `oxfmt` (format) then `oxlint --fix` (auto-fix). If fixes leave diagnostics behind, it runs `oxlint` again and surfaces the final diagnostics to the agent — the way they surface (or whether at all) is controlled by `mode`, `ignore` globs, and fingerprint-based loop prevention.

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
| `oxfmtBin`            | `oxfmt`                                                  | Binary or path used to run oxfmt.        |
| `oxfmtConfigPath`     | unset                                                    | Optional oxfmt config passed with `-c`.  |
| `oxfmtDisableNestedConfig` | `false`                                             | Adds `--disable-nested-config` to oxfmt. |
| `extensions`          | JS/TS/Vue extensions                                     | File extensions to lint.                 |
| `maxLines`            | `2000`                                                   | Skip files over this line count.         |
| `log`                 | `true`                                                   | Write local summary logs.                |
| `logPath`             | `~/.local/state/opencode-oxc-lint/opencode-oxc-lint.log` | Log destination.                         |
| `maxHints`            | `3`                                                      | Max times identical diagnostics for one file are injected per session. |
| `mode`                | `fix`                                                    | How diagnostics surface to the agent: `fix` \| `notify` \| `silent`. |
| `ignore`              | `[]`                                                     | Glob patterns; matched files skip the pipeline entirely.                |

### Mode

Controls how remaining diagnostics reach the agent after `oxfmt` + `oxlint --fix` + `oxlint`:

| mode     | Injected into tool output | Behavior                                  |
| -------- | ------------------------- | ----------------------------------------- |
| `fix`    | `[oxc-lint] <file>: ...`  | Agent is expected to act on the diagnostics. |
| `notify` | `[oxc-lint: informational, no fix needed] ...` | Visible to the agent but marked as no-fix-needed. |
| `silent` | not injected              | Logged + toasted only; agent never sees it. |

### Ignore

Glob patterns matched against the cwd-relative path (and the raw path). Matched files skip the whole pipeline — no format, no lint, no injection, no hint counting. Highest priority, overrides `mode`.

```json
{ "oxc-lint": { "ignore": ["**/*.test.ts", "dist/**", "src/generated/**"] } }
```

### Loop prevention (fingerprint dedupe)

Per file/session the plugin keeps a diagnostics fingerprint + counter:

- fingerprint **unchanged** (agent can't/won't fix) → counter rises; after `maxHints` repetitions the same diagnostics are no longer injected
- fingerprint **changed** (partial fix / new error) → counter resets to 1 and diagnostics are re-injected
- file goes **clean** → record cleared, next error starts fresh

## Two-level config

Options are merged from two sources (scalars: project > user; `ignore` arrays: union):

| Level  | Path                                                                |
| ------ | ------------------------------------------------------------------ |
| user   | `~/.config/opencode/jacob-z-harness-opencode.json` (`oxc-lint` field) |
| project | `<cwd>/.jacob-z/jacob-z-harness-opencode.json` (`oxc-lint` field) |

## Behavior

- Runs after successful `edit`, `write`, and `apply_patch` tools.
- Pipeline order: `oxfmt` (format) → `oxlint --fix` (auto-fix) → `oxlint` (check).
- Skips unsupported, deleted, missing, and over-large files.
- Files matching `ignore` skip the pipeline entirely.
- Appends remaining diagnostics according to `mode`.
