---
title: 添加 Skills 和 MCP
category: skills
tags: [omp, skills, mcp, howto]
aliases: [如何添加 Skill 和 MCP Server]
sources:
  - AGENTS.md
summary: 在 [[projects/jacob-omp-collections/jacob-omp-collections|jacob-omp-collections]] 中添加 OMP Skill 和 MCP Server 的步骤与规范。
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

# 添加 Skills 和 MCP

## 添加 Skill

1. 在 `skills/` 下新建目录，放入 `SKILL.md`

2. 运行 `./[[projects/jacob-omp-collections/concepts/installation-and-deployment|install.sh]]`，脚本自动 symlink 到 `~/.omp/agent/skills/<name>`

OMP 加载路径：`~/.omp/agent/skills/*/SKILL.md`

## 添加 MCP Server

1. 编辑 `mcp/mcp.json`，在 `mcpServers` 中添加 server 配置：

```json
{
  "mcpServers": {
    "my-server": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@example/mcp-server"]
    }
  }
}
```

2. 运行 `./install.sh`，脚本将配置 merge 到 `~/.omp/agent/mcp.json`

OMP 加载路径：`~/.omp/agent/mcp.json`

## 限制

- Skills 和 MCP **不能**通过 [[projects/jacob-omp-collections/concepts/marketplace-system|marketplace]] 插件分发，只能通过 symlink/merge 安装
- 不要修改 `.claude-plugin/marketplace.json` 的顶层结构（`name`、`owner`）
