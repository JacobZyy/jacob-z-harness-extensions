---
title: Hot Cache
updated: 2026-06-03T04:03:00Z
---

# Hot Cache

_A ~500-word semantic snapshot of recent activity. Updated after every major write operation._

## Recent Activity

- [2026-06-03T04:03:00Z] **History ingest: OMP 会话记录 (6/2-6/3)** — 从 oh-my-pi 仓库的 3 个新 OMP 会话中提取知识，创建 2 个新页面（marketplace-skill-loading、oh-my-pi 项目概览），记录了 plugin: 前缀问题和二进制编译机制。
- [2026-05-31T06:00:00Z] **[[projects/jacob-omp-collections/entities/oxlint-gate]] 插件踩坑记录更新** — 更新了 aicodegather-troubleshooting.md 和 oxlint-gate.md，记录了 marketplace 安装后插件不加载和 `~` 路径未展开两个关键问题。
- [2026-05-31T02:30:00Z] **History ingest: OMP 会话记录 (5/29)** — 从 [[projects/jacob-omp-collections/jacob-omp-collections]] 和 oh-my-pi 两个仓库的 OMP 会话 JSONL 中提取知识，创建 2 个新页面、更新 2 个已有页面。

## Active Threads

- **oxlint-gate 插件开发完成** — 从 Claude Code hook 移植到 OMP Extension，已解决 marketplace 安装和路径处理问题，插件功能正常。
- **OMP marketplace 安装机制 bug** — `omp plugin install` 不更新 `package.json#dependencies`，需要 `install.sh --fix-links` 手动修复。

## Key Takeaways

- OMP 的插件发现机制依赖 `~/.omp/plugins/package.json#dependencies`，而不是 `installed_plugins.json`
- marketplace 安装后必须同步三个文件：package.json、symlink、cache
- OMP 提供的路径可能以 `~` 开头，`path.isAbsolute('~/...')` 返回 true 但不会自动展开
- 实时拦截比会话结束批量检查更好：oxlint-gate 在 tool_call 阶段检查，比 aicodegather 的 preEditCache 方案更简单

## Flagged Contradictions

_None yet._
