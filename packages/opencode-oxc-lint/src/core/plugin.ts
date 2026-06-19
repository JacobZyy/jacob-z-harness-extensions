import type { Plugin, PluginOptions } from '@opencode-ai/plugin'
import type { OxcLintOptions } from './config'
import type { ProbeResult } from './probe'
import type { HintState, LinterAdapter, LinterName } from './types'
import { expandHome, normalizeOptions } from './config'
import { handleToolAfter } from './handler'
import { writeLocalLog } from './log'
import { probeAndInject } from './probe'
import { extractToolPaths } from './resolve'

function toOptions(options?: PluginOptions | OxcLintOptions): OxcLintOptions {
  return (options ?? {}) as OxcLintOptions
}

const EDIT_TOOLS = new Set(['edit', 'write', 'apply_patch'])

/**
 * Assemble an opencode plugin from a registry of linter adapters.
 *
 * The base is linter-agnostic: at runtime it picks the adapter named by the
 * `linter` config field (default `oxlint`). This is the "base + tool-plugin"
 * seam — register more adapters in `src/index.ts` and they become selectable
 * purely through configuration.
 */
export function createPlugin(adapters: Record<LinterName, LinterAdapter>): Plugin {
  return async (input, options) => {
    const pluginOptions = toOptions(options)

    // 会话启动嗅探：检测到 eslint 配置包则注入项目级配置（先于 normalize，
    // 使本轮 normalizeOptions 读到注入结果）。
    let probeResult: ProbeResult | undefined
    try {
      probeResult = probeAndInject(input.directory)
    }
    catch {
      // 嗅探失败不影响插件加载
    }

    const normalized = normalizeOptions(pluginOptions, input.directory)
    const logPath = expandHome(normalized.logPath) ?? normalized.logPath
    const hintStates = new Map<string, Map<string, HintState>>()

    if (normalized.log) {
      writeLocalLog(logPath, { action: 'check', summary: `plugin loaded (linter=${normalized.linter})` })
      if (probeResult)
        writeLocalLog(logPath, { action: 'check', summary: `probe: linter=${probeResult.linter} written=${probeResult.written}` })
    }

    setTimeout(() => {
      input.client.tui
        .showToast({
          body: {
            title: 'oxc-lint',
            message: `plugin loaded · ${normalized.linter}`,
            variant: 'info',
          },
        })
        .catch(() => {})
    }, 2000)

    return {
      'tool.execute.after': async (hookInput, output) => {
        if (normalized.log && EDIT_TOOLS.has(hookInput.tool)) {
          writeLocalLog(logPath, {
            tool: hookInput.tool,
            action: 'check',
            summary: `collected: ${JSON.stringify(extractToolPaths(hookInput.tool, hookInput.args))}`,
          })
        }

        const runtimeOptions = normalizeOptions(pluginOptions, input.directory)
        const adapter = adapters[runtimeOptions.linter]

        const result = await handleToolAfter(
          hookInput,
          output,
          { cwd: input.directory },
          hintStates,
          adapter,
          { options: pluginOptions },
        )

        if (result.filesProcessed > 0) {
          input.client.tui
            .showToast({
              body: {
                title: 'oxc-lint',
                message:
                  result.filesWithDiagnostics > 0
                    ? `${result.filesWithDiagnostics}/${result.filesProcessed} file(s) have lint issues`
                    : `${result.filesProcessed} file(s) formatted + linted clean`,
                variant: result.filesWithDiagnostics > 0 ? 'warning' : 'success',
              },
            })
            .catch(() => {})
        }
      },
    }
  }
}
