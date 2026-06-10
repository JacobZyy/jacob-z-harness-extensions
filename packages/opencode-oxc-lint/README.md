# opencode-oxc-lint

OpenCode plugin that runs `oxlint` after source-file edits.

The plugin runs `oxlint --fix` first. If fixes leave diagnostics behind, it runs `oxlint` again and appends the final diagnostics to the OpenCode tool output so the agent can continue fixing them.

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
| `extensions`          | JS/TS/Vue extensions                                     | File extensions to lint.                 |
| `maxLines`            | `2000`                                                   | Skip files over this line count.         |
| `log`                 | `true`                                                   | Write local summary logs.                |
| `logPath`             | `~/.local/state/opencode-oxc-lint/opencode-oxc-lint.log` | Log destination.                         |

## Behavior

- Runs after successful `edit`, `write`, and `apply_patch` tools.
- Skips unsupported, deleted, missing, and over-large files.
- Appends output only when configuration errors or remaining diagnostics need agent attention.
- Does not run formatters; configure OpenCode formatter separately.
