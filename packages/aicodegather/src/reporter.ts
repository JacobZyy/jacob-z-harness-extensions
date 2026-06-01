import type { CodeEditItem, CodeEditPayload, SessionBackup, SessionStartPayload } from './types'
import { getReportUrl, getSessionUrl, MAX_RETRIES, REQUEST_TIMEOUT_MS, RETRY_INTERVAL_MS, VERSION } from './config'
import { getEnvType, getGitRemoteUrl, getGitRoot, getGitUser } from './git-ops'
import { createLogger, createRetryLogger } from './logger'

const log = createLogger('reporter')
const retryLog = createRetryLogger('reporter')

/** fetch with abort-timeout */
async function fetchWithTimeout(url: string, body: unknown): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    clearTimeout(timer)
    const text = await res.text()
    log.debug(`响应状态码: ${res.status}`)
    log.debug(`响应body: ${text.slice(0, 500) || 'empty'}`)
    return res.ok
  }
  catch (e) {
    log.debug(`请求异常: ${e instanceof Error ? e.message : String(e)}`)
    return false
  }
}

/** In-memory retry queue */
interface RetryTask {
  url: string
  body: unknown
  remaining: number
  timer: ReturnType<typeof setTimeout> | null
}

const retryQueue: RetryTask[] = []

function scheduleRetry(task: RetryTask): void {
  if (task.remaining <= 0)
    return
  task.timer = setTimeout(async () => {
    retryQueue.splice(retryQueue.indexOf(task), 1)
    const ok = await fetchWithTimeout(task.url, task.body)
    if (!ok) {
      task.remaining--
      retryLog.warn(`retry failed (${task.remaining} left): ${task.url}`)
      scheduleRetry(task)
    }
    else {
      retryLog.info(`retry ok: ${task.url}`)
    }
  }, RETRY_INTERVAL_MS)
}

function enqueueRetry(url: string, body: unknown): void {
  const task: RetryTask = { url, body, remaining: MAX_RETRIES, timer: null }
  retryQueue.push(task)
  retryLog.warn(`enqueued retry: ${url}`)
  scheduleRetry(task)
}

/** Report a code edit */
export async function reportCodeEdit(item: CodeEditItem): Promise<void> {
  const reportUrl = getReportUrl()
  if (!reportUrl) {
    log.warn('reportUrl not configured, skipping code edit report')
    return
  }

  const payload: CodeEditPayload = { codeList: [item] }
  log.info(`开始立即上报: filePath=${item.filePath}, hash=${item.hash}`)
  log.debug(`URL: ${reportUrl}`)
  log.debug(`payload: ${JSON.stringify(payload, null, 2)}`)

  const ok = await fetchWithTimeout(reportUrl, payload)
  if (!ok) {
    log.error(`立即上报失败，加入重试队列: ${item.filePath}`)
    enqueueRetry(reportUrl, payload)
  }
  else {
    log.info(`立即上报成功: ${item.filePath}`)
  }
}

/** Report session start telemetry */
export async function reportSessionStart(cwd: string): Promise<void> {
  const sessionUrl = getSessionUrl()
  if (!sessionUrl) {
    log.warn('sessionUrl not configured, skipping session start report')
    return
  }

  const root = getGitRoot(cwd) ?? cwd
  const remoteUrl = getGitRemoteUrl(root) ?? ''

  const userName = getGitUser(root)
  const env = getEnvType(remoteUrl)
  log.debug(`获取用户信息: user_name=${userName}, env=${env}, version=${VERSION}`)

  const backup: SessionBackup = {
    userName,
    ipaddress: '',
    env,
    type: 0,
    mcpReportType: 'mcpInit',
    version: VERSION,
  }
  const payload: SessionStartPayload = {
    cookieid: '666888',
    appid: 'ZHUANZHUAN',
    actiontype: 'zzcodeInit',
    pagetype: 'zzcode',
    backup,
  }

  log.info('========== 发送埋点 ==========')
  log.debug(`URL: ${sessionUrl}`)
  log.debug(`payload: ${JSON.stringify(payload, null, 2)}`)

  log.info(`reporting session start: user=${userName}, env=${env}`)
  const ok = await fetchWithTimeout(sessionUrl, payload)
  if (!ok) {
    log.error('埋点发送失败，加入重试队列')
    enqueueRetry(sessionUrl, payload)
  }
  else {
    log.info('埋点发送成功')
  }
}
