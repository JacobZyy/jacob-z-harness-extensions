---
title: Marketplace 安装机制深入理解
tags: [omp, marketplace, plugin-system, debugging, installation]
summary: 基于多个 OMP 会话深入理解 marketplace 安装机制、与 Claude Code marketplace 的关系、以及 [[projects/jacob-omp-collections/concepts/installation-and-deployment|install.sh]] 的问题。
created: 2026-06-02
provenance:
  source: omp_conversation
  project: [[projects/jacob-omp-collections/jacob-omp-collections]]
  sessions:
    - 019e8433-1e87-7000-85d1-e60014e490ea
    - 019e80d5-c0c2-7000-ba44-aaf98a3bdaa7
    - 019e81d4-1386-7000-afcc-1c3c767b04b0
    - 019e81b2-53ce-7000-a5e4-3ce593f354aa
    - 019e8287-b108-7000-976d-20fdbcdc7949
  mix: extracted(40%) + inferred(60%)
base_confidence: 0.65
lifecycle: draft
lifecycle_changed: 2026-06-02
---

# Marketplace 安装机制深入理解

## 核心发现

### Marketplace 与 Claude Code 的关系

OMP 的 marketplace 是 Claude Code marketplace 的**完全子集**。这意味着：

- OMP 复用了 Claude Code 的 marketplace 架构和注册机制
- 所有 OMP marketplace 插件同时也兼容 Claude Code
- 这是设计决策，不是限制 — 保持兼容性 ^[inferred]

### [[projects/jacob-omp-collections/concepts/installation-and-deployment|install.sh]] 的问题

在多次调试中发现 [[projects/jacob-omp-collections/concepts/installation-and-deployment|install.sh]] 存在以下问题：

- 安装 marketplace 插件后，settings 中只显示部分插件（如 `dir-entry-plugin` 和 `omp-notify-tool`）
- `omp list` 命令显示的插件列表与 settings 不一致
- 建议：**删除 [[projects/jacob-omp-collections/concepts/installation-and-deployment|install.sh]]**，改用标准的 `omp install` 命令流程

### 插件安装流程

正确的 marketplace 插件安装流程：

1. 通过 `omp install <plugin-name>` 安装
2. 插件注册到 marketplace 体系中
3. settings 中的 Plugins 部分应自动更新

### Marketplace 清理

在会话 `019e8433` 中，执行了以下清理操作：

- 移除了仓库中与 marketplace 相关的内容
- 清空了 OMP 中关于 claude-plugin 的配置
- 提交并推送了代码

## 已知问题

1. **插件列表不同步** — settings 和 `omp list` 显示不一致
2. **[[projects/jacob-omp-collections/concepts/installation-and-deployment|install.sh]] 幂等性差** — 多次运行可能产生不一致状态
3. **marketplace 配置残留** — 删除插件后配置可能残留

## 相关页面

- [[projects/jacob-omp-collections/concepts/marketplace-system]]
- [[projects/jacob-omp-collections/skills/plugin-config-debugging]]
- [[projects/jacob-omp-collections/skills/adding-a-plugin]]
