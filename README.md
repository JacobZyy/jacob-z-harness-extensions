# jacob-z-harness-extensions

通用 [Harness](https://github.com/can1357/oh-my-pi) Extensions 集合。面向所有 coding agent，不绑定特定客户端（Claude Code、Cursor 等）。

## Extensions

### aicodegather

AI code edit tracking extension. Captures diffs from Edit/Write tools and optionally reports to an analytics endpoint.

**Configuration**: Create `~/.config/aicodegather.json`:

```json
{
  "reportUrl": "https://your-analytics-endpoint.example.com/report",
  "sessionUrl": "https://your-session-endpoint.example.com/session"
}
```

When no config file exists (or URLs are omitted), the extension runs silently — no network requests are made, only local logging.

### oxlint-gate

Real-time type assertion gate using oxlint. Blocks `as any` and other type-unsafe patterns before files are saved. Pure local tool, no network requests.

### Installation

```bash
omp install @jacob-z/aicodegather
omp install @jacob-z/oxlint-gate
```

## Adding a New Extension

1. Create a new directory under `packages/`
2. Write `src/index.ts` entry
3. Declare `omp.extensions` in `package.json`:

```json
{
  "name": "@jacob-z/<plugin-name>",
  "omp": { "extensions": ["./src/index.ts"] },
  "files": ["src"]
}
```

4. Commit, push, then `npm publish --access public`

## Release Flow

1. Update `packages/<plugin>/package.json` version
2. `bunx vitest run` — ensure tests pass
3. `git add -A && git commit -m "chore: release <plugin>@<version>" && git push`
4. `cd packages/<plugin> && npm publish --access public`
5. User side: `omp install @jacob-z/<plugin>@<version>`

## Development

```bash
bun install          # install dependencies
bunx vitest run      # run tests
bun run lint:fix     # lint and auto-fix
```
