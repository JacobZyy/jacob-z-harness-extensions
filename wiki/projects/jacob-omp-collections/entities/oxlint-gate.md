---
title: oxlint-gate
category: entities
tags: [omp, extension, lint, type-safety, oxlint]
aliases: [oxlint 类型断言门禁]
sources:
  - packages/oxlint-gate/src/index.ts
  - packages/oxlint-gate/package.json
  - marketplace.json
summary: >-
  OMP Extension 插件，实时拦截包含 as any 等类型断言的代码编辑，使用 oxlint 检查并阻断。
provenance:
  extracted: 0.9
  inferred: 0.1
  ambiguous: 0.0
base_confidence: 0.85
lifecycle: draft
lifecycle_changed: 2026-05-31
created: 2026-05-31T06:00:00Z
updated: 2026-06-01T12:00:00Z
---

# oxlint-gate

oxlint-gate 是一个 OMP Marketplace Extension 插件，用于在代码编辑时实时检查类型断言违规。当用户使用 Edit/Write 工具时，插件会拦截并检查目标文件，如果发现 `as any`、`as unknown as X` 等类型偷懒断言，会阻断编辑并提供修复建议。

从 Claude Code 的 oxlint-stop.ts hook 移植而来，适配了 OMP Extension API。

## 核心功能

- **实时拦截**：在工具调用前检查，不是事后检查
- **oxlint 集成**：使用与 CLI 相同的规则
- **可配置**：读取 `~/.config/oxlint/oxlintrc.json` 中的 ignorePatterns
- **失败开放**：oxlint 未安装或崩溃时放行编辑
- **本地日志**：写入 `~/.omp/logs/oxlint-gate.log`
- **自动修复**：lint 失败时尝试自动修复，但需防止闭环循环

## 事件监听

只监听 `tool_call` 事件，不需要跨事件保持状态（避免了 aicodegather 的路径不一致问题）。

## 工具模式支持

支持 OMP edit 工具的 4 种模式：

| 模式          | path 提取方式                                            |
| ------------- | -------------------------------------------------------- |
| replace/patch | `input.path` 字段                                        |
| write         | `input.path` 字段                                        |
| hashline      | 从 `input.input` 解析 `¶path#hash`                       |
| apply-patch   | 从 `input.input` 解析 `*** Add/Update/Delete File: path` |

## 踩坑记录

### marketplace 安装后不加载

**原因**：OMP 从 `package.json#dependencies` 发现插件，而不是 `installed_plugins.json`。

**修复**：`install.sh --fix-links` 同时修复 symlink 和 package.json。

### `~` 路径未展开

**原因**：OMP 提供 `~/Documents/...` 格式路径，`isAbsolute` 返回 true 但 `~` 未展开。

**修复**：添加 `expandTilde()` 函数。

## 与 Claude Code hook 的区别
## 自动修复与闭环防护

oxlint-gate 支持 lint 失败后自动尝试修复。关键设计考虑：

1. **stdout 过长处理**：oxlint 输出可能很长，需要截断或摘要后反馈给 LLM
2. **闭环循环防护**：如果用户通过提示词要求忽略某个异常，lint+修复逻辑不应形成无限循环。防护策略包括：
   - 记录已忽略的规则，避免重复触发修复
   - 设置单次会话最大修复尝试次数
   - 区分「用户主动忽略」和「未解决的违规」

可通过 AGENTS.md 配置忽略特定规则（如 `no-explicit-any`），验证闭环防护是否生效。^[inferred]

| 特性   | Claude Code hook      | OMP extension          |
| ------ | --------------------- | ---------------------- |
| 时机   | 会话结束时批量检查    | 实时拦截（编辑前检查） |
| 阻断   | 阻断会话              | 阻断工具调用           |
| 数据源 | 读取 JSONL transcript | 拦截 tool_call 事件    |
| 性能   | 批量检查所有改动文件  | 单文件检查每次编辑     |

## 相关链接

- [[projects/jacob-omp-collections/entities/aicodegather]] — 同仓库的另一个 Extension 插件
- [[projects/jacob-omp-collections/skills/aicodegather-troubleshooting]] — 详细排查记录
- [[projects/jacob-omp-collections/concepts/plugin-architecture]] — OMP Extension 架构
