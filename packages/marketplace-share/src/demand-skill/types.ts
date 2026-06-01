export interface DemandConfig {
  tapdApiBase: string
  configPath: string
}

export interface TapdParseResult {
  workspaceId: string | null
  storyId: string | null
}

export interface StoryListOptions {
  page?: number
  pageSize?: number
  withLongText?: boolean
  storyId?: string
}
