import process from 'node:process'
import { formatStoryContent, getStoryById, getStoryList, parseTapdUrl } from './tapd'

interface CliArgs {
  input: string
  storyId: string | null
  page: number
  pageSize: number
  format: 'json' | 'text'
}

function parseArgs(argv: string[]): CliArgs | null {
  let input = ''
  let storyId: string | null = null
  let page = 1
  let pageSize = 10
  let format: 'json' | 'text' = 'json'

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i]
    if (!arg)
      continue
    if ((arg === '--story-id' || arg === '-s') && i + 1 < argv.length) {
      storyId = argv[++i] ?? null
    }
    else if ((arg === '--page' || arg === '-p') && i + 1 < argv.length) {
      page = Number.parseInt(argv[++i] ?? '1', 10)
    }
    else if ((arg === '--page-size' || arg === '-n') && i + 1 < argv.length) {
      pageSize = Number.parseInt(argv[++i] ?? '10', 10)
    }
    else if ((arg === '--format' || arg === '-f') && i + 1 < argv.length) {
      format = (argv[++i] ?? 'json') as 'json' | 'text'
    }
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: bun run cli.ts <tapd_url_or_workspace_id> [options]')
      console.log('')
      console.log('Options:')
      console.log('  --story-id, -s <id>    Specify story ID')
      console.log('  --page, -p <num>       Page number (default: 1)')
      console.log('  --page-size, -n <num>  Page size (default: 10)')
      console.log('  --format, -f <format>  Output format: json or text (default: json)')
      process.exit(0)
    }
    else if (!arg.startsWith('-')) {
      input = arg
    }
  }

  if (!input)
    return null
  return { input, storyId, page, pageSize, format }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv)
  if (!args) {
    process.stderr.write('Usage: bun run cli.ts <tapd_url_or_workspace_id> [options]\n')
    process.exit(1)
  }

  let workspaceId: number | null = null
  let storyId: string | null = args.storyId

  if (args.input.includes('tapd.cn')) {
    const parsed = parseTapdUrl(args.input)
    if (parsed.workspaceId) {
      workspaceId = Number.parseInt(parsed.workspaceId, 10)
    }
    if (parsed.storyId) {
      storyId = parsed.storyId
    }
    if (!workspaceId) {
      process.stderr.write(`无法从 URL 解析 workspace_id: ${args.input}\n`)
      process.exit(1)
    }
  }
  else {
    workspaceId = Number.parseInt(args.input, 10)
    if (Number.isNaN(workspaceId)) {
      process.stderr.write(`无效的 workspace_id: ${args.input}\n`)
      process.exit(1)
    }
  }

  if (storyId) {
    const story = await getStoryById(workspaceId, storyId)
    if (story) {
      if (args.format === 'text') {
        console.log(formatStoryContent(story))
      }
      else {
        console.log(JSON.stringify(story, null, 2))
      }
    }
    else {
      process.stderr.write(`未找到需求: ${storyId}\n`)
      process.exit(1)
    }
  }
  else {
    const result = await getStoryList([workspaceId], {
      page: args.page,
      pageSize: args.pageSize,
    })
    if (result) {
      if (args.format === 'text') {
        const stories = (result as { respData?: { list?: Record<string, unknown>[] } }).respData?.list ?? []
        for (const story of stories) {
          console.log(formatStoryContent(story))
          console.log('-'.repeat(50))
        }
      }
      else {
        console.log(JSON.stringify(result, null, 2))
      }
    }
    else {
      process.stderr.write('获取需求列表失败\n')
      process.exit(1)
    }
  }
}

main()
