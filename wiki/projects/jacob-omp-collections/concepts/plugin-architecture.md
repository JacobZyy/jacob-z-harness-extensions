---
title: OMP Extension 架构
category: concepts
tags: [omp, extension-api, architecture]
aliases: [Extension API, 插件架构]
sources:
  - AGENTS.md
summary: OMP Extension API 的架构设计与事件模型——ExtensionFactory、事件钩子与生命周期。
provenance:
  extracted: 0.9
  inferred: 0.1
  ambiguous: 0.0
base_confidence: 0.68
lifecycle: draft
lifecycle_changed: 2026-05-31
created: 2026-05-31T02:20:00Z
updated: 2026-05-31T02:20:00Z
---

# OMP Extension 架构

OMP 提供一套 Extension API，允许插件开发者通过事件驱动的方式扩展代理的行为。

## Extension 入口

每个插件通过 `src/index.ts` 导出默认函数，类型为 `ExtensionFactory`：

```typescript
import type { ExtensionAPI } from '@oh-my-pi/pi-coding-agent'

export default function myPlugin(pi: ExtensionAPI) {
  pi.on('session_start', async (_event, ctx) => { /* ... */ })
  pi.on('tool_call', async (event) => { /* ... */ })
  pi.on('tool_result', async (event) => { /* ... */ })
}
```

## 可用事件

| 事件            | 触发时机       | 用途                     |
| --------------- | -------------- | ------------------------ |
| `session_start` | 会话启动时     | 上报会话信息、初始化资源 |
| `tool_call`     | 工具被调用时   | 拦截/缓存/验证           |
| `tool_result`   | 工具返回结果时 | 计算 diff、上报数据      |
| `turn_start`    | 每轮对话开始时 | —                        |
| `turn_end`      | 每轮对话结束时 | —                        |
| `context`       | 上下文变更时   | —                        |

## Package.json 注册

插件必须在 `package.json` 中声明 `omp.extensions` 字段：

```json
{
  "name": "@jacob-omp-collections/<plugin-name>",
  "omp": { "extensions": ["./src/index.ts"] }
}
```

## 实际实现模式

jacob-omp-collections 中的两个插件展示了两种不同的模式：

- [[projects/jacob-omp-collections/entities/aicodegather]] — 纯上报模式：缓存 pre-edit 内容，计算 diff 并上报
- [[projects/jacob-omp-collections/entities/oxlint-gate]] — 拦截验证模式：在编辑前检查文件，发现违规则返回 `{ block: true, reason: ... }` 阻止操作

两者都共享 `extractFilePath()` 工具函数来从不同工具输入模式中提取文件路径。
