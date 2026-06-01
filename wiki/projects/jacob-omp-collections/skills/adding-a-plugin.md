---
title: 添加 Marketplace 插件
category: skills
tags: [omp, marketplace, plugin, howto]
aliases: [如何添加插件]
sources:
  - AGENTS.md
summary: 在 jacob-omp-collections 中添加新的 Marketplace 插件（extensions/tools/hooks/commands）的完整步骤。
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

# 添加 Marketplace 插件

## 步骤

1. 在 `packages/` 下新建目录（命名：小写字母、数字、连字符）

2. 编写 `src/index.ts` 作为 Extension 入口

3. `package.json` 声明 `omp.extensions`：

```json
{
  "name": "@jacob-omp-collections/<plugin-name>",
  "omp": { "extensions": ["./src/index.ts"] }
}
```

4. 在 `.claude-plugin/marketplace.json` 的 `plugins` 数组中追加：

```json
{
  "name": "<plugin-name>",
  "description": "描述",
  "source": "./packages/<plugin-name>"
}
```

5. 提交并推送代码

6. 用户在 OMP 会话内更新插件索引：

```
/marketplace update jacob-omp-collections
```

## 安装已验证的插件

```
/marketplace add JacobZyy/jacob-omp-collections
/marketplace install <plugin-name>@jacob-omp-collections
```

## 开发校验

提交前必须通过：

- `bun run lint:fix`
- `bunx vitest run`
