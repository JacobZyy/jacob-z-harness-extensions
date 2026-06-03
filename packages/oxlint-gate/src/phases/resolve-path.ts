import type { ExtensionContext, ToolCallEvent, ToolResultEvent } from '../omp-types'
import { TS_EXTENSIONS, WRITE_TOOLS } from '../lib/log'
import { extractFilePath, isExistingFile, resolveFilePath } from '../lib/utils'

export interface ResolvedPath {
  filePath: string
  toolName: string
}

/**
 * Resolve the target file path from a tool_call event.
 * Returns undefined if the event is not a write tool or the file is not checkable.
 */
export function resolveFromToolCall(event: ToolCallEvent, ctx: ExtensionContext): ResolvedPath | undefined {
  if (!WRITE_TOOLS.has(event.toolName))
    return undefined

  const rawPath = extractFilePath(event.input as Record<string, unknown>)
  if (!rawPath)
    return undefined

  const filePath = resolveFilePath(rawPath, ctx.cwd)
  if (!TS_EXTENSIONS.test(filePath))
    return undefined
  if (!isExistingFile(filePath))
    return undefined

  return { filePath, toolName: event.toolName }
}

/**
 * Resolve the target file path from a tool_result event.
 * Returns undefined if the event is not a write tool.
 */
export function resolveFromToolResult(event: ToolResultEvent, _ctx: ExtensionContext): ResolvedPath | undefined {
  if (!WRITE_TOOLS.has(event.toolName))
    return undefined

  const rawPath = extractFilePath(event.input as Record<string, unknown>)
  if (!rawPath)
    return undefined

  const filePath = resolveFilePath(rawPath, _ctx.cwd)
  if (!TS_EXTENSIONS.test(filePath))
    return undefined
  if (!isExistingFile(filePath))
    return undefined

  return { filePath, toolName: event.toolName }
}
