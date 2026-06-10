---
title: AGENTS.md 参考
category: references
tags: [omp, documentation, reference]
aliases: [项目文档]
sources:
  - AGENTS.md
summary: [[projects/jacob-omp-collections/jacob-omp-collections|jacob-omp-collections]] 项目文档 AGENTS.md 的完整内容摘要，包括项目结构、安装和操作指南。
provenance:
  extracted: 0.95
  inferred: 0.05
  ambiguous: 0.0
base_confidence: 0.68
lifecycle: draft
lifecycle_changed: 2026-05-31
created: 2026-05-31T02:20:00Z
updated: 2026-05-31T02:20:00Z
---

# AGENTS.md 参考

AGENTS.md 是 jacob-omp-collections 的主要项目文档，包含完整的项目结构、安装说明、内容添加指南和开发规范。

## 内容概述

- **项目结构** — 顶层目录设计：`.claude-plugin/`、`packages/`、`skills/`、`mcp/`
- **安装方法** — `[[projects/jacob-omp-collections/concepts/installation-and-deployment|install.sh]]` 的三种模式（默认、--all、--uninstall）
- **[[projects/jacob-omp-collections/skills/adding-a-plugin|添加 Marketplace 插件]]** — 从创建目录到 `marketplace update` 的完整流程
- **添加 Skill** — 创建 `SKILL.md` 并运行 `install.sh`
- **添加 MCP Server** — 编辑 `mcp/mcp.json` 并运行 `install.sh`
- **OMP [[projects/jacob-omp-collections/concepts/plugin-architecture|Extension API]]** — 事件类型和 `ExtensionFactory` 签名
- **命名规范** — 目录名和 marketplace name 约定
- **约束** — Skills 和 MCP 不能通过 marketplace 分发
- **开发校验** — lint:fix → vitest run
