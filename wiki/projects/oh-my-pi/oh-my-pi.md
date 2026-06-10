---
title: oh-my-pi
category: project
tags: [oh-my-pi, coding-agent, cli, typescript]
summary: OMP (Oh My Pi) coding agent CLI 工具，支持多模型、工具调用、技能加载和 MCP 集成。
source_path: ~/.omp/agent/sessions/-Documents-workspace-jacob-open-source-oh-my-pi
created: 2026-06-03T12:00:00Z
updated: 2026-06-03T12:00:00Z
base_confidence: 0.42
lifecycle: draft
lifecycle_changed: 2026-06-03
---

# oh-my-pi

OMP (Oh My Pi) 是一个 TypeScript 编写的 coding agent CLI 工具，支持多 LLM 提供商、工具调用、技能系统和 MCP 服务器集成。

## 包结构

| 包 | 描述 |
|---|---|
| `packages/ai` | 多提供商 LLM 客户端，支持流式 |
| `packages/agent` | Agent 运行时，工具调用与状态管理 |
| `packages/coding-agent` | 主 CLI 应用（核心） |
| `packages/tui` | 终端 UI 差异渲染 |
| `packages/natives` | 原生文本/图片/grep 操作绑定 |
| `packages/stats` | 本地可观测性仪表盘 |
| `packages/utils` | 共享工具（日志、流、临时文件） |
| `crates/pi-natives` | Rust crate，性能关键操作 |

## 关键概念

- [[projects/oh-my-pi/concepts/marketplace-skill-loading]] — marketplace 插件技能加载机制与已知问题

## 技术栈

- TypeScript + Bun 运行时
- Rust (N-API) 用于性能关键操作
- 支持多 LLM：OpenAI、Zhipu、Xiaomi Mimo 等

## 相关页面

- [[projects/jacob-omp-collections/jacob-omp-collections]] — OMP 插件集合仓库
- [[projects/jacob-omp-collections/concepts/plugin-architecture]] — Extension API 架构
