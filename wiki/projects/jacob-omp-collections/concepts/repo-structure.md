---
title: 仓库结构
category: concepts
tags: [omp, repo-structure, conventions]
aliases: [目录结构, 项目布局]
sources:
  - AGENTS.md
summary: [[projects/jacob-omp-collections/jacob-omp-collections|jacob-omp-collections]] 的目录组织规范，每个顶层目录的职责与约束。
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

# 仓库结构

## 顶层目录

### `.claude-plugin/`

存放 OMP Marketplace 索引文件 `marketplace.json`。声明所有可安装的 extensions、hooks、tools、commands 类型插件。

### `packages/`

Marketplace 插件的源代码目录。每个子目录是一个独立的 npm 包。

约束：

- 每个插件必须包含 `package.json`，声明 `omp.extensions` 字段
- `src/index.ts` 作为 Extension 入口
- 不要在 `packages/` 下放非插件内容

支持通过 Workspace 协议统一管理依赖（`package.json` 中声明 `"workspaces": ["packages/*"]`）。

### `skills/`

OMP Skills 目录。每个子目录包含一个 `SKILL.md` 文件。

安装方式：`install.sh` 会遍历此目录，将每个 skill 目录 symlink 到 `~/.omp/agent/skills/<name>`。

OMP 加载路径：`~/.omp/agent/skills/*/SKILL.md`

约束：

- Skills 不能通过 marketplace 插件分发，仅支持本地 symlink

### `mcp/`

MCP server 配置目录。核心文件是 `mcp.json`，格式为标准 MCP server 配置。

安装方式：`install.sh` 会将 `mcp/mcp.json` 与 `~/.omp/agent/mcp.json` 合并（以仓库配置为准，同名 key 覆盖）。

OMP 加载路径：`~/.omp/agent/mcp.json`

约束：

- MCP 配置不能通过 marketplace 插件分发，仅支持本地文件 merge

### 根目录文件

| 文件           | 职责                                             |
| -------------- | ------------------------------------------------ |
| `install.sh`   | 一键安装脚本                                     |
| `AGENTS.md`    | 项目文档，包含目录结构、安装、添加内容的完整说明 |
| `package.json` | monorepo 配置，eslint 和 commit 规范             |

## 命名规范

- 目录名：小写字母、数字、连字符
- marketplace.json 中的 `name` 与目录名一致

## 开发校验

每次开发完成后需按顺序执行：

1. `bun run lint:fix` — 直到零报错
2. `bunx vitest run` — 直到全部通过
