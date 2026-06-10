---
title: Marketplace 技能加载机制
category: concepts
tags: [oh-my-pi, marketplace, skills, debugging, plugin-system]
summary: OMP marketplace 插件技能的加载流程、plugin: 前缀问题、优先级系统与去重机制。
provenance:
  extracted: 0.7
  inferred: 0.3
  ambiguous: 0.0
base_confidence: 0.42
lifecycle: draft
lifecycle_changed: 2026-06-03
created: 2026-06-03T12:00:00Z
updated: 2026-06-03T12:00:00Z
---

# Marketplace 技能加载机制

OMP 的 marketplace 插件技能加载由 `claude-plugins.ts` 提供者处理，存在 `plugin:` 前缀导致 `skill://` URL 解析失败的问题。

## 技能加载架构

### 提供者优先级

| 提供者 | 优先级 | 来源 |
|---|---|---|
| `claude.ts` | 80 | `~/.claude/skills/` 原生技能 |
| `claude-plugins.ts` | 70 | `~/.omp/plugins/cache/` marketplace 插件 |

当同名技能存在于两个提供者时，优先级更高的 Claude 原生技能胜出。

### 加载流程

1. `claude-plugins.ts` 的 `loadSkills()` 调用 `listClaudePluginRoots()` 获取已安装插件
2. 遍历每个插件的 `skills/` 目录，调用 `scanSkillsFromDir()` 扫描 SKILL.md
3. 为每个技能名称添加 `plugin:` 前缀（如 `superpowers:brainstorming`）
4. `extensibility/skills.ts` 的 `loadSkills()` 合并所有提供者结果
5. `capability` 层的 dedup-by-key 按优先级去重

## plugin: 前缀问题

### 症状

用户安装 marketplace 插件后，无法通过 `skill://brainstorming` 调用技能。实际注册名称为 `superpowers:brainstorming`。

### 根因

`claude-plugins.ts` 第 123 行：
```typescript
if (root.plugin) skill.name = `${root.plugin}:${skill.name}`;
```

冒号 `:` 在 URL 解析中与端口分隔符冲突，导致 `skill://superpowers:brainstorming` 解析异常。

### 修复方案（已尝试但撤回）

移除 `plugin:` 前缀，依赖 capability 层的 dedup-by-key 按优先级处理名称冲突：
```typescript
// 不添加前缀，dedup-by-key 已处理冲突
items.push(...result.items);
```

修复后技能数从 198 降至 186（去重生效），但用户反馈 `skill://brainstorming` 仍不可用，最终撤回改动。

### 未解决的问题

- marketplace 技能即使不带前缀，也可能被同名的 Claude 原生技能覆盖
- `--no-mcp` 模式下部分提供者可能未加载
- 需要进一步调查 `skill://` URL 路由机制

## 二进制编译与原生插件

omp 二进制在编译时通过 `embed:native` 嵌入 `.node` 文件的元数据（包括文件大小）。启动时如果 `~/.omp/natives/` 下的文件大小与嵌入 manifest 不匹配，会重新提取旧的 `.node`。

**关键结论**：替换磁盘上的 `.node` 文件无效，必须重新运行完整的构建流程：
```bash
bun run packages/coding-agent/scripts/build-binary.ts
```

构建流程：`embed:native` → `bun build --compile` → `embed:native --reset`

## 相关页面

- [[projects/oh-my-pi/oh-my-pi]] — oh-my-pi 项目概览
- [[projects/jacob-omp-collections/concepts/plugin-architecture]] — OMP Extension API 架构
- [[projects/jacob-omp-collections/concepts/marketplace-system]] — Marketplace 发布与更新机制
