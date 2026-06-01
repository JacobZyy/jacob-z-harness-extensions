# jacob-z

OMP marketplace plugin collection for [Oh My Pi](https://github.com/nichochar/oh-my-pi).

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
# Add marketplace (one-time)
:/marketplace add JacobZyy/jacob-omp-collections

# Install a plugin
:/marketplace install aicodegather@jacob-z
:/marketplace install oxlint-gate@jacob-z
```

Extension plugins also require a symlink in `~/.omp/plugins/node_modules/`:

```bash
# After marketplace install, create symlink manually:
# (replace <version> and <cache-path> with actual values from ~/.omp/plugins/cache/)
:ln -s <cache-path> ~/.omp/plugins/node_modules/@jacob-z/<plugin-name>
```

## Releasing a New Version

1. Update `packages/<plugin>/package.json` `version` field
2. Commit: `git commit -m "release: <plugin>@<version>"`
3. Push: `git push`
:4. In OMP session: `/marketplace update jacob-omp-collections` then `omp plugin upgrade <name>@jacob-z`

## Development

```bash
bun install          # install dependencies
bunx vitest run      # run tests
bun run lint:fix     # lint and auto-fix
```
