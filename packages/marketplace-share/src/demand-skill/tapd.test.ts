import { describe, expect, it } from 'vitest'
import { extractWorkspaceId, formatStoryContent, parseTapdUrl } from './tapd'

describe('parseTapdUrl', () => {
  it('parses dialog_preview_id format', () => {
    const result = parseTapdUrl('https://www.tapd.cn/?dialog_preview_id=story_1120512331001795647')
    expect(result.workspaceId).toBe('20512331')
    expect(result.storyId).toBe('1120512331001795647')
  })

  it('parses /prong/stories/view format', () => {
    const result = parseTapdUrl('https://www.tapd.cn/20512331/prong/stories/view/1120512331001795647')
    expect(result.workspaceId).toBe('20512331')
    expect(result.storyId).toBe('1120512331001795647')
  })

  it('parses /tapd_fe/story/detail format', () => {
    const result = parseTapdUrl('https://www.tapd.cn/tapd_fe/23837991/story/detail/1123837991001799374')
    expect(result.workspaceId).toBe('23837991')
    expect(result.storyId).toBe('1123837991001799374')
  })

  it('returns null for non-tapd URL', () => {
    const result = parseTapdUrl('https://example.com/something')
    expect(result.workspaceId).toBeNull()
    expect(result.storyId).toBeNull()
  })

  it('extracts workspace_id from story_id when not in URL', () => {
    const result = parseTapdUrl('https://www.tapd.cn/?dialog_preview_id=story_1120512331001795647')
    expect(result.workspaceId).toBe('20512331')
  })

  it('returns null for empty input', () => {
    const result = parseTapdUrl('')
    expect(result.workspaceId).toBeNull()
    expect(result.storyId).toBeNull()
  })
})

describe('extractWorkspaceId', () => {
  it('extracts workspace_id from valid story_id', () => {
    expect(extractWorkspaceId('1120512331001795647')).toBe('20512331')
  })

  it('returns null for story_id too short', () => {
    expect(extractWorkspaceId('11205')).toBeNull()
  })

  it('returns null for story_id not starting with 11', () => {
    expect(extractWorkspaceId('9920512331001795647')).toBeNull()
  })
})

describe('formatStoryContent', () => {
  it('formats story as markdown with all fields', () => {
    const story = {
      storyName: '测试需求',
      storyId: '1120512331001795647',
      chineseStatus: '开发中',
      creator: '张三',
      storyOwner: '李四',
      priority: '高',
      storyDescription: '这是一个测试需求描述',
      map: {
        自定义字段: { customFieldValue: '自定义值' },
      },
    }
    const result = formatStoryContent(story)
    expect(result).toContain('# 测试需求')
    expect(result).toContain('1120512331001795647')
    expect(result).toContain('开发中')
    expect(result).toContain('张三')
    expect(result).toContain('李四')
    expect(result).toContain('高')
    expect(result).toContain('这是一个测试需求描述')
    expect(result).toContain('自定义字段')
    expect(result).toContain('自定义值')
  })

  it('handles missing fields gracefully', () => {
    const result = formatStoryContent({})
    expect(result).toContain('未命名需求')
    expect(result).toContain('N/A')
  })

  it('falls back to storyStatus when chineseStatus is missing', () => {
    const story = { storyName: 'Test', storyStatus: 'done' }
    const result = formatStoryContent(story)
    expect(result).toContain('done')
  })
})
