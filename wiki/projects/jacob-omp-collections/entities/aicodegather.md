---
title: aicodegather
category: entities
tags: [omp, extension, analytics, code-tracking]
aliases: [AI Code Edit Tracking]
sources:
  - packages/aicodegather/src/[[index]].ts
  - marketplace.json
  - packages/aicodegather/TROUBLESHOOTING.md
  - ~/.omp/agent/sessions/-Documents-workspace-jacob-open-source-oh-my-pi/
summary: OMP Extension 插件，捕获 AI 编辑/写入工具的代码 diff 并上报到内部分析系统。从 Claude Code hooks 迁移至 OMP Extension API。
provenance:
  extracted: 0.75
  inferred: 0.25
  ambiguous: 0.0
base_confidence: 0.72
lifecycle: draft
lifecycle_changed: 2026-05-31
created: 2026-05-31T02:20:00Z
updated: 2026-05-31T02:30:00Z
---

# aicodegather

aicodegather 是一个 OMP [[projects/jacob-omp-collections/concepts/marketplace-system|Marketplace]] Extension 插件，用于追踪 AI 代理对代码的编辑操作。它监听 OMP 的 `tool_call` 和 `tool_result` 事件，捕获 `edit` 和 `write` 工具的代码变更并上报到内部分析系统。

原为 Claude Code hooks 方案（Python 脚本通过 `~/.claude/settings.json` 的 PostToolUse/PreToolUse/SessionStart 钩子触发），后迁移至 OMP Extension API。

## 迁移时间线

- **v1.3.0** — Claude Code hooks 方案：Python 脚本写 `/tmp/aicodegather/logs/hook.log`，log 正常触发，但 edit 的 filePath 提取总是 undefined
- **v1.4.0-1.4.3** — 迁移至 OMP Extension API（TS 类型 + extractFilePath 函数），但加载/运行时问题导致 tool_call/tool_result 日志消失
- **v1.5.0** — 全链路正常，日志完整

## 事件监听

- `session_start` — 上报会话启动信息，包含当前工作目录
- `tool_call` — 在编辑/写入前缓存文件原始内容（pre-edit cache）
- `tool_result` — 在编辑完成后计算 diff 并上报

## 工具模式支持

OMP 的 edit 工具有 4 种模式，aicodegather 全部支持：

| 模式          | path 提取方式                                                    |
| ------------- | ---------------------------------------------------------------- |
| replace/patch | `input.path` 字段                                                |
| write         | `input.path` 字段                                                |
| hashline      | 从 `input.input` 解析 `¶path#hash`、`§path#hash` 或 `@path#hash` |
| apply-patch   | 从 `input.input` 解析 `*** Add/Update/Delete File: path`         |

## 上报数据结构

```typescript
{
  namespace: string // Git 命名空间
  branchName: string // 分支名
  gitName: string // Git 用户名
  code: string // diff 内容
  filePath: string // 相对路径
  hash: string // diff 的哈希值
  env: string // 环境标识
  source: 'omp-extension'
  aiType: 2
}
```

## 过滤逻辑

- 仅处理 `toolName === 'edit'` 或 `toolName === 'write'` 的事件
- 工具报错（`isError === true`）时跳过
- 仅处理 git remote 包含 `gitlab.zhuanspirit.com` 的仓库 ^[inferred]
- 通过 `FileFilter.shouldProcess()` 进一步过滤文件类型

## 已知问题

- **post_edit 找不到 pre_edit 缓存**：`extractFilePath()` 在 tool_call 和 tool_result 阶段返回的路径可能不一致，导致 `preEditCache.get(filePath)` 返回 undefined
- **Git 远程 URL 检测**：SSH 格式 (`git@`) 的远程 URL 在某些场景下被检测为 null
- **symlink 状态不一致**：`installed_plugins.json`、`package.json deps`、symlink target 三者版本不匹配导致插件无法被 OMP 发现

## 相关链接

- [[projects/jacob-omp-collections/concepts/marketplace-system]] — OMP Marketplace 系统
- [[projects/jacob-omp-collections/entities/oxlint-gate]] — 同仓库的另一个 Extension 插件
- [[projects/jacob-omp-collections/concepts/plugin-architecture]] — OMP Extension 架构
- [[projects/jacob-omp-collections/skills/aicodegather-troubleshooting]] — 详细排查记录
