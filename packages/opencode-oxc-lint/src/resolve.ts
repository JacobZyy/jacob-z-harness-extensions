import { existsSync, readFileSync } from 'node:fs'
import { extname, isAbsolute, join } from 'node:path'

interface FilterOptions {
  cwd: string
  extensions: string[]
  maxLines: number
}

const TEST_LIKE_FILE_RE = /\.(?:test|spec)\.[^.]+$/

function getStringField(args: Record<string, unknown>, key: string): string | undefined {
  const value = args[key]
  return typeof value === 'string' ? value : undefined
}

export function extractToolPaths(tool: string, args: Record<string, unknown>): string[] {
  if (tool === 'write' || tool === 'edit') {
    const path = getStringField(args, 'filePath') ?? getStringField(args, 'path')
    return path ? [path] : []
  }

  if (tool !== 'apply_patch')
    return []

  const patchText = getStringField(args, 'patchText') ?? getStringField(args, 'patch')
  if (!patchText)
    return []

  const paths: string[] = []
  for (const line of patchText.split('\n')) {
    const match = line.match(/^\*\*\* (?:Add File|Update File|Delete File|Move to): (\S.*)$/)
    if (match?.[1])
      paths.push(match[1].trim())
  }
  return Array.from(new Set(paths))
}

export function countLines(filePath: string): number {
  const content = readFileSync(filePath, 'utf8')
  if (content.length === 0)
    return 0

  return content.endsWith('\n') ? content.split('\n').length - 1 : content.split('\n').length
}

export function filterLintableFiles(paths: string[], options: FilterOptions): string[] {
  const result: string[] = []

  for (const path of paths) {
    const absolute = isAbsolute(path) ? path : join(options.cwd, path)
    if (!existsSync(absolute))
      continue

    if (!options.extensions.includes(extname(absolute)))
      continue

    if (TEST_LIKE_FILE_RE.test(absolute))
      continue

    if (countLines(absolute) > options.maxLines)
      continue

    result.push(absolute)
  }

  return Array.from(new Set(result))
}
