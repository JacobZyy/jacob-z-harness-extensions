import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

import { expandHome } from './config'

export interface LogEntry {
  sessionID?: string
  tool?: string
  file?: string
  action: 'skip' | 'fix' | 'check' | 'error'
  exitCode?: number
  summary: string
}

export function writeLocalLog(logPath: string, entry: LogEntry): void {
  const expanded = expandHome(logPath)
  if (!expanded)
    return

  const line = JSON.stringify({
    time: new Date().toISOString(),
    ...entry,
  })

  mkdirSync(dirname(expanded), { recursive: true })
  appendFileSync(expanded, `${line}\n`)
}
