---
title: jacob-omp-collections
category: project
tags: [omp, marketplace, plugins, skills, mcp]
aliases: [OMP Collections]
sources:
  - AGENTS.md
  - install.sh
  - marketplace.json
  - package.json
summary: 集中管理 OMP 插件、Skills、MCP 配置的 monorepo，通过 install.sh 一键安装到本地环境。
provenance:
  extracted: 0.85
  inferred: 0.15
  ambiguous: 0.0
base_confidence: 0.82
lifecycle: draft
lifecycle_changed: 2026-05-31
created: 2026-05-31T02:20:00Z
updated: 2026-05-31T02:20:00Z
---

# jacob-omp-collections

jacob-omp-collections 是一个用于管理 OMP（Oh My PI）插件的 monorepo。所有内容集中在一个仓库，通过 `install.sh` 一键安装到本地的 OMP 代理环境中。

## 项目结构

```
jacob-omp-collections/
├── .claude-plugin/
│   └── marketplace.json     ← Marketplace 索引
├── packages/                 ← Marketplace 插件源代码
│   ├── aicodegather/         ← AI 代码编辑追踪插件
│   └── oxlint-gate/          ← oxlint 类型断言检查插件
├── skills/                   ← OMP Skills（symlink 到 ~/.omp/agent/skills/）
├── mcp/                      ← MCP server 配置
│   └── mcp.json
├── install.sh                ← 一键安装脚本
├── AGENTS.md                 ← 项目文档
└── package.json              ← monorepo 配置（workspaces 指向 packages/*）
```

## 安装方式

- `./install.sh` — 安装 skills + MCP
- `./install.sh --all` — 显示 marketplace 安装命令 + 安装 skills + MCP
- `./install.sh --uninstall` — 卸载

Marketplace 插件需要在 OMP 会话内通过 `/marketplace install` 手动安装。

## 关键链接

- [[projects/jacob-omp-collections/concepts/installation-and-deployment]] — install.sh 脚本详细说明
- [[projects/jacob-omp-collections/concepts/repo-structure]] — 目录结构与职责
- [[projects/jacob-omp-collections/concepts/marketplace-system]] — OMP Marketplace 发布与更新机制
- [[projects/jacob-omp-collections/concepts/plugin-architecture]] — OMP Extension 架构
- [[projects/jacob-omp-collections/entities/aicodegather]] — 代码编辑追踪插件
- [[projects/jacob-omp-collections/entities/oxlint-gate]] — 类型断言检查插件
- [[projects/jacob-omp-collections/skills/adding-a-plugin]] — 添加 Marketplace 插件
- [[projects/jacob-omp-collections/skills/adding-skills-and-mcp]] — 添加 Skills 和 MCP
- [[projects/jacob-omp-collections/skills/aicodegather-troubleshooting]] — aicodegather 排查记录

## Sources

- [[projects/jacob-omp-collections/references/agents-doc]] — AGENTS.md 原文参考
