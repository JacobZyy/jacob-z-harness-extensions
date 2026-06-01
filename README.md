# jacob-z

OMP plugin collection for [Oh My Pi](https://github.com/nichochar/oh-my-pi).

## Plugins

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

## Installation

```bash
# In OMP session:
omp install @jacob-z/aicodegather
omp install @jacob-z/oxlint-gate
```

Or via marketplace (also available):

```
/marketplace add JacobZyy/jacob-omp-collections
/marketplace install aicodegather@jacob-omp-collections
/marketplace install oxlint-gate@jacob-omp-collections
```

> **Note**: Extension plugins installed via marketplace also need a symlink in `~/.omp/plugins/node_modules/@jacob-z/` pointing to the cache directory. The `omp install` method handles this automatically.

## Releasing a New Version

1. Update `packages/<plugin>/package.json` `version` field
2. Commit: `git commit -m "chore: release <plugin>@<version>"`
3. Push: `git push`
4. Publish: `cd packages/<plugin> && npm publish --access public`
5. In OMP session: `omp install @jacob-z/<plugin>@<version>`

## Development

```bash
bun install          # install dependencies
bunx vitest run      # run tests
bun run lint:fix     # lint and auto-fix
```
