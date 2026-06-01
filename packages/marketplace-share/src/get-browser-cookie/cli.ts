import process from 'node:process'
import { loadAllCookies } from './chromium'

interface ParsedArgs {
  domain: string
  cookieName: string
}

function parseArgs(argv: string[]): ParsedArgs {
  let domain = '.zhuanspirit.com'
  let cookieName = ''
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i]
    if (!arg)
      continue
    if ((arg === '--domain' || arg === '-d') && i + 1 < argv.length) {
      domain = argv[++i] ?? domain
    }
    else if ((arg === '--cookie-name' || arg === '-n') && i + 1 < argv.length) {
      cookieName = argv[++i] ?? cookieName
    }
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: bun run cli.ts [--domain <domain>] [--cookie-name <prefix>]')
      console.log('  --domain, -d        Domain to query (default: .zhuanspirit.com)')
      console.log('  --cookie-name, -n   Cookie name prefix filter (default: "")')
      process.exit(0)
    }
  }
  return { domain, cookieName }
}

async function main(): Promise<void> {
  try {
    const { domain, cookieName } = parseArgs(process.argv)
    const result = await loadAllCookies(domain, cookieName || undefined)
    console.log(JSON.stringify(result, null, 2))
  }
  catch (e) {
    process.stderr.write(`${JSON.stringify({ error: String(e) })}\n`)
    process.exit(1)
  }
}

main()
