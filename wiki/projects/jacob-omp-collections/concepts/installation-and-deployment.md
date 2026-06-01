---
title: 安装与部署
category: concepts
tags: [omp, install, deployment, symlink, merge]
aliases: [install.sh, 安装脚本]
sources:
  - install.sh
  - AGENTS.md
summary: install.sh 安装脚本的完整工作流程——Skills symlink、MCP merge、Marketplace 插件手动安装。
provenance:
  extracted: 0.85
  inferred: 0.15
  ambiguous: 0.0
base_confidence: 0.7
lifecycle: draft
lifecycle_changed: 2026-05-31
created: 2026-05-31T02:20:00Z
updated: 2026-05-31T02:20:00Z
---

# 安装与部署

`install.sh` 是 jacob-omp-collections 的一键安装脚本，负责将仓库内容部署到本地 OMP 环境。

## 目标路径

| 组件             | 目标路径                     | 操作类型                        |
| ---------------- | ---------------------------- | ------------------------------- |
| Skills           | `~/.omp/agent/skills/<name>` | Symlink                         |
| MCP              | `~/.omp/agent/mcp.json`      | Merge（Python JSON merge）      |
| Marketplace 插件 | OMP 内手动安装               | 手动执行 `/marketplace install` |

## Skills 安装流程

1. 遍历 `skills/*/` 目录
2. 对每个子目录，创建 symlink：`~/.omp/agent/skills/<name>` → `$REPO_DIR/skills/<name>/`
3. 如目标已存在 symlink，先删除再重建
4. 如目标存在真实目录（非 symlink），跳过并给出警告

## MCP 安装流程

1. 读取 `mcp/mcp.json` 中的 `mcpServers` 数量
2. 如数量为 0（空配置），跳过
3. 如 `~/.omp/agent/mcp.json` 已存在，用 Python 进行 JSON merge（仓库配置覆盖同名 key）
4. 如不存在，直接复制

Merge 策略：以仓库配置为准，覆盖目标中同名的 MCP server 配置。仅添加/更新，不删除已有 server。

## Marketplace 插件安装

不在 install.sh 中自动安装，仅显示提示信息让用户在 OMP 会话内手动执行：

```
/marketplace add JacobZyy/jacob-omp-collections
/marketplace install aicodegather@jacob-omp-collections
/marketplace install oxlint-gate@jacob-omp-collections
```

## 卸载流程

- 删除已安装的 Skills symlink
- 从 `~/.omp/agent/mcp.json` 中移除本仓库添加的 MCP server
- Marketplace 插件需手动 `/marketplace uninstall`
