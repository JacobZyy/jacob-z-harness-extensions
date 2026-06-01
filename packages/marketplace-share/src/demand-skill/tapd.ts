import type { StoryListOptions, TapdParseResult } from './types'
import { loadConfig } from './config'

/**
 * 从 TAPD URL 中解析 workspace_id 和 story_id。
 * 支持三种 URL 格式：
 * 1. ?dialog_preview_id=story_XXXX
 * 2. /{workspace_id}/prong/stories/view/{story_id}
 * 3. /tapd_fe/{workspace_id}/story/detail/{story_id}
 */
export function parseTapdUrl(url: string): TapdParseResult {
  if (!url || !url.includes('tapd.cn')) {
    return { workspaceId: null, storyId: null }
  }

  let storyId: string | null = null
  let workspaceId: string | null = null

  try {
    const parsed = new URL(url)
    const queryParams = parsed.searchParams

    // 格式1: ?dialog_preview_id=story_XXXX
    const previewId = queryParams.get('dialog_preview_id')
    if (previewId) {
      const match = /story_(\d+)/.exec(previewId)
      if (match) {
        storyId = match[1]!
      }
    }

    // 格式2: /{workspace_id}/prong/stories/view/{story_id}
    if (!storyId) {
      const prongMatch = /\/(\d+)\/prong\/stories\/view\/(\d+)/.exec(parsed.pathname)
      if (prongMatch) {
        workspaceId = prongMatch[1]!
        storyId = prongMatch[2]!
      }
    }

    // 格式3: /tapd_fe/{workspace_id}/story/detail/{story_id}
    if (!storyId) {
      const tapdFeMatch = /\/tapd_fe\/(\d+)\/story\/detail\/(\d+)/.exec(parsed.pathname)
      if (tapdFeMatch) {
        workspaceId = tapdFeMatch[1]!
        storyId = tapdFeMatch[2]!
      }
    }

    // 从 story_id 中提取 workspace_id
    if (storyId && !workspaceId) {
      workspaceId = extractWorkspaceId(storyId)
    }
  }
  catch {
    // URL 解析失败
  }

  return { workspaceId, storyId }
}

/**
 * 从 story_id 中提取 workspace_id。
 * story_id 格式: 11 + workspace_id(8位) + 序号
 */
export function extractWorkspaceId(storyId: string): string | null {
  if (storyId.length >= 10 && storyId.startsWith('11')) {
    return storyId.slice(2, 10)
  }
  return null
}

/**
 * 获取 TAPD 需求列表。
 */
export async function getStoryList(
  workspaceIds: number[],
  opts?: StoryListOptions,
): Promise<Record<string, unknown> | null> {
  const config = loadConfig()
  const url = `${config.tapdApiBase}/getThumbnailStoryList`

  const payload: Record<string, unknown> = {
    workspaceIds,
    page: opts?.page ?? 1,
    pageSize: opts?.pageSize ?? 10,
    withLongText: opts?.withLongText ?? true,
  }

  if (opts?.storyId) {
    payload.storyIds = [opts.storyId]
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30_000)

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      return null
    }

    return await response.json() as Record<string, unknown>
  }
  catch {
    return null
  }
}

/**
 * 根据需求 ID 获取单个需求详情。
 */
export async function getStoryById(
  workspaceId: number,
  storyId: string,
): Promise<Record<string, unknown> | null> {
  const result = await getStoryList([workspaceId], {
    page: 1,
    pageSize: 1,
    withLongText: true,
    storyId,
  })

  if (!result)
    return null

  const list = (result as { respData?: { list?: Record<string, unknown>[] } }).respData?.list
  if (list && list.length > 0) {
    return list[0]!
  }
  return null
}

/**
 * 格式化需求内容为可读 Markdown 文本。
 */
export function formatStoryContent(story: Record<string, unknown>): string {
  const lines: string[] = []

  const name = String(story.storyName ?? '')
  lines.push(`# ${name || '未命名需求'}`)
  lines.push('')
  lines.push(`**需求ID**: ${story.storyId ?? 'N/A'}`)
  lines.push(`**状态**: ${story.chineseStatus ?? story.storyStatus ?? 'N/A'}`)
  lines.push(`**创建人**: ${story.creator ?? 'N/A'}`)
  lines.push(`**负责人**: ${story.storyOwner ?? 'N/A'}`)
  lines.push(`**优先级**: ${story.priority ?? 'N/A'}`)
  lines.push('')

  const description = String(story.storyDescription ?? story.description ?? '')
  if (description) {
    lines.push('## 需求描述')
    lines.push(description)
    lines.push('')
  }

  const customMap = story.map as Record<string, Record<string, unknown>> | undefined
  if (customMap && typeof customMap === 'object') {
    lines.push('## 自定义字段')
    for (const [fieldName, fieldData] of Object.entries(customMap)) {
      if (fieldData && typeof fieldData === 'object') {
        const value = fieldData.customFieldValue
        if (value) {
          lines.push(`- **${fieldName}**: ${value}`)
        }
      }
    }
    lines.push('')
  }

  return lines.join('\n')
}
