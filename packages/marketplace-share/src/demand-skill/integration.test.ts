/**
 * Integration tests for demand-skill (TAPD).
 * Requires network access to internal TAPD API.
 * These tests hit real TAPD endpoints — skipped in CI.
 *
 * Run locally: CI= bunx vitest run integration
 */
import { describe, expect, it } from 'vitest'
import { formatStoryContent, getStoryById, parseTapdUrl } from './tapd'

const TAPD_STORY_URL = 'https://www.tapd.cn/tapd_fe/my/work?dialog_preview_id=story_1146670835001828415'
const EXPECTED_WORKSPACE_ID = '46670835'
const EXPECTED_STORY_ID = '1146670835001828415'

describe.skipIf(process.env.CI)('integration: TAPD', () => {
  it('parses TAPD URL and fetches story content', async () => {
    // Step 1: Parse URL
    const parsed = parseTapdUrl(TAPD_STORY_URL)
    expect(parsed.storyId).toBe(EXPECTED_STORY_ID)
    expect(parsed.workspaceId).toBe(EXPECTED_WORKSPACE_ID)

    // Step 2: Fetch story
    const story = await getStoryById(
      Number.parseInt(EXPECTED_WORKSPACE_ID, 10),
      EXPECTED_STORY_ID,
    )
    expect(story).not.toBeNull()

    // Step 3: Verify key fields
    expect(story!.storyId).toBe(EXPECTED_STORY_ID)
    expect(story!.storyName).toContain('骑行门店')
    expect(story!.creator).toBeTruthy()
    expect(story!.storyOwner).toBeTruthy()

    // Step 4: Format as text
    const text = formatStoryContent(story!)
    expect(text).toContain('# 骑行门店')
    expect(text).toContain(EXPECTED_STORY_ID)
    expect(text).toContain('开发中')
    expect(text).toContain('马浪')
    expect(text).toContain('需求描述')

    // Custom fields should be present
    expect(text).toContain('FE预计开始')
    expect(text).toContain('需求优先级')
  })

  it('formatStoryContent output matches expected structure for real story', async () => {
    const story = await getStoryById(
      Number.parseInt(EXPECTED_WORKSPACE_ID, 10),
      EXPECTED_STORY_ID,
    )
    expect(story).not.toBeNull()

    const text = formatStoryContent(story!)

    // Verify markdown structure
    const lines = text.split('\n')
    expect(lines[0]).toMatch(/^# .+/) // Title heading
    expect(text).toContain('**需求ID**:')
    expect(text).toContain('**状态**:')
    expect(text).toContain('**创建人**:')
    expect(text).toContain('**负责人**:')
    expect(text).toContain('## 需求描述')
    expect(text).toContain('## 自定义字段')

    // Verify specific custom fields from this story
    expect(text).toContain('pm确认结论')
    expect(text).toContain('需求类型')
  })
})
