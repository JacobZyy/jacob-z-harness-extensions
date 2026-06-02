import type { GitInfo } from './types'
import { spawnSync } from 'node:child_process'
import { dirname } from 'node:path'

function runGit(args: string[], cwd: string): string | null {
  try {
    const result = spawnSync('git', args, {
      cwd,
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    if (result.status !== 0)
      return null
    return result.stdout.trim() || null
  }
  catch {
    return null
  }
}

/** 获取文件所在 git 仓库根目录 */
export function getGitRoot(filePath: string): string | null {
  return runGit(['rev-parse', '--show-toplevel'], dirname(filePath))
}

/** 获取 git 用户名 */
export function getGitUser(cwd: string): string {
  return runGit(['config', 'user.name'], cwd) ?? 'unknown'
}

/** 获取当前分支名 */
export function getGitBranch(cwd: string): string {
  return runGit(['rev-parse', '--abbrev-ref', 'HEAD'], cwd) ?? 'unknown'
}

/** 获取 remote origin URL */
export function getGitRemoteUrl(cwd: string): string | null {
  return runGit(['remote', 'get-url', 'origin'], cwd)
}

/** 从 remote URL 提取 namespace（仅取 group，即第一个 '/' 之前的部分） */
export function getGitNamespace(remoteUrl: string): string {
  // Strategy: strip protocol, strip host, strip .git suffix, take first segment
  let rest = remoteUrl
  // Remove protocol
  rest = rest.replace(/^[a-z]+:\/\//, '')
  // Remove user@ prefix
  rest = rest.replace(/^[^@]+@/, '')
  // Remove host (everything up to : or /)
  const hostEnd = rest.search(/[:/]/)
  if (hostEnd === -1)
    return 'unknown'
  rest = rest.slice(hostEnd + 1)
  // Remove .git suffix
  rest = rest.replace(/\.git$/, '')
  // Only take the first segment (group), e.g. "zz-youpin/n_lab_store" → "zz-youpin"
  const firstSlash = rest.indexOf('/')
  return firstSlash === -1 ? (rest || 'unknown') : rest.slice(0, firstSlash)
}

/** 根据 remote URL 判断环境 */
export function getEnvType(remoteUrl: string): string {
  // Private git hosts are internal; everything else is external
  if (remoteUrl.includes('gitlab.'))
    return 'internal'
  return 'external'
}

/** 获取文件相对于 git root 的相对路径 */
export function getRelativePath(filePath: string): string {
  const root = getGitRoot(filePath)
  if (!root)
    return filePath
  const result = runGit(['ls-files', '--error-unmatch', filePath], root)
  return result ?? filePath
}

/** 一次性获取文件的完整 git 信息 */
export function getGitInfo(filePath: string): GitInfo {
  const cwd = dirname(filePath)
  const root = getGitRoot(filePath) ?? cwd
  const remoteUrl = getGitRemoteUrl(root) ?? ''
  return {
    namespace: getGitNamespace(remoteUrl),
    branch: getGitBranch(root),
    user: getGitUser(root),
    env: getEnvType(remoteUrl),
    remoteUrl,
  }
}
