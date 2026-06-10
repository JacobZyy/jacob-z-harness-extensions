---
title: 脚本实现方案对比
tags: [omp, scripting, typescript, python, best-practices]
summary: OMP skill 和 extension 中脚本实现方案对比：TypeScript vs Python vs Shell，以及 Claude Code 下的考量。
created: 2026-06-02
provenance:
  source: omp_conversation
  project: oh-my-pi
  sessions:
    - 019e8253-2a6c-7000-add9-ad9d2b449685
  mix: extracted(50%) + inferred(50%)
base_confidence: 0.65
lifecycle: draft
lifecycle_changed: 2026-06-02
---

# 脚本实现方案对比

## 背景

在 OMP 的 skill 和 extension 中，经常需要编写可直接执行的脚本。三种主要方案各有优劣。

## 方案对比

| 维度 | TypeScript | Python | Shell |
|------|-----------|--------|-------|
| **类型安全** | ✅ 强类型 | ⚠️ 动态类型 | ❌ 无类型 |
| **依赖管理** | npm/bun | pip/venv | 系统依赖 |
| **启动速度** | ⚠️ 需编译 | ⚠️ 解释器启动 | ✅ 最快 |
| **生态丰富度** | ✅ npm 生态 | ✅ PyPI 生态 | ⚠️ 有限 |
| **调试体验** | ✅ 好 | ✅ 好 | ❌ 差 |
| **跨平台** | ✅ 好 | ✅ 好 | ❌ 差 |
| **与 OMP 集成** | ✅ 原生 | ⚠️ 需包装 | ⚠️ 需包装 |

## 推荐策略

### OMP Extension 场景

**推荐 TypeScript**：
- 与 OMP Extension API 原生集成
- 共享项目的依赖和构建流程
- 类型安全减少运行时错误

### Claude Code Skill 场景

**推荐 Python 或 TypeScript**：
- Python 适合数据处理、脚本自动化
- TypeScript 适合需要类型安全的工具
- Shell 仅适合简单的系统命令包装

### 决策矩阵

```
需要与 OMP API 交互？ → TypeScript
需要复杂数据处理？   → Python
需要调用系统命令？   → Shell（包装在 TS/Python 中）
需要快速原型？       → Python
需要类型安全？       → TypeScript
```

## 最佳实践

1. **统一语言** — 同一项目/模块中保持语言一致性
2. **Shell 包装** — 将 shell 命令封装在 TypeScript/Python 函数中
3. **错误处理** — 所有脚本都应有完善的错误处理
4. **文档注释** — 脚本头部应说明用途和依赖

## 相关页面

- [[projects/jacob-omp-collections/concepts/plugin-architecture]]
- [[projects/jacob-omp-collections/skills/adding-skills-and-mcp]]
