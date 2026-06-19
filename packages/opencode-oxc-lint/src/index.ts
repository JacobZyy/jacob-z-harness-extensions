import type { Plugin, PluginModule } from '@opencode-ai/plugin'
import type { LinterAdapter, LinterName } from './core/types'

import { eslintAdapter } from './adapters/eslint'
import { oxlintAdapter } from './adapters/oxlint'
import { createPlugin } from './core/plugin'

/**
 * Adapter registry — the "tool-plugin" side of the base + tool-plugin split.
 *
 * Add a new linter by implementing `LinterAdapter` under `src/adapters/` and
 * registering it here; it becomes selectable through the `linter` config field
 * with no changes to the base layer.
 */
export const ADAPTERS: Record<LinterName, LinterAdapter> = {
  oxlint: oxlintAdapter,
  eslint: eslintAdapter,
}

const plugin: Plugin = createPlugin(ADAPTERS)

/**
 * opencode loads plugins via the V1 `PluginModule` shape (`{ id, server }`).
 * A bare-function default falls through to the legacy loader, which scans
 * every named export and throws on the first non-function (e.g. the ADAPTERS
 * registry object) — silently failing the whole plugin. Exporting a
 * PluginModule keeps us on the V1 path. `id` is required for path-sourced
 * plugins (opencode resolves the plugin id from it).
 */
const pluginModule: PluginModule = { id: 'opencode-oxc-lint', server: plugin }
export default pluginModule

// Re-exports for consumers and tests.
export { createPlugin }
export { expandHome, normalizeOptions } from './core/config'
export { hashDiagnostics } from './core/fingerprint'
export {
  createCollector,
  handleSessionIdle,
  handleToolAfter,
} from './core/handler'
export { runPipelineForFile } from './core/pipeline'
export { detectLinter, probeAndInject } from './core/probe'
export type { ProbeResult } from './core/probe'
export type * from './core/types'
