---
title: OMP Marketplace 系统
category: concepts
tags: [omp, marketplace, plugin-system, publishing]
aliases: [Marketplace 发布, 插件市场]
sources:
  - ~/.omp/agent/sessions/-Documents-workspace-jacob-open-source-oh-my-pi/
  - ~/.omp/agent/sessions/-Documents-workspace-jacob-open-source-jacob-omp-collections/
summary: OMP Marketplace 的完整工作流——插件索引、安装、更新、dev 模式与卸载机制。
provenance:
  extracted: 0.7
  inferred: 0.3
  ambiguous: 0.0
base_confidence: 0.6
lifecycle: draft
lifecycle_changed: 2026-05-31
created: 2026-05-31T02:30:00Z
updated: 2026-06-01T12:00:00Z
---

# OMP Marketplace 系统

## 基本概念

OMP Marketplace 是一个插件分发系统。每个 marketplace 是一个 Git 仓库，通过 `marketplace.json` 声明插件列表。

### marketplace.json 结构

```json
{
  "name": "jacob-omp-collections",
  "owner": { "name": "Jacob" },
  "description": "...",
  "plugins": [
    {
      "name": "[[projects/jacob-omp-collections/entities/aicodegather|aicodegather]]",
      "description": "...",
      "source": "./packages/aicodegather",
      "category": "development"
    }
  ]
}
```

## 添加 Marketplace

```
/marketplace add JacobZyy/jacob-omp-collections
```

## 安装插件

```
/marketplace install aicodegather@jacob-omp-collections
```

安装后 OMP 会：

1. 将插件源码（含目录结构）复制到 `~/.omp/plugins/cache/plugins/jacob-omp-collections___aicodegather___<version>/`
2. 创建 symlink：`~/.omp/plugins/node_modules/@jacob-omp-collections/aicodegather` → 缓存目录
3. 更新 `~/.omp/plugins/package.json` 中的 dependencies（版本号）
4. 更新 `~/.omp/plugins/installed_plugins.json`

## 更新插件

Marketplace 更新分两步：

1. **更新 marketplace 索引**（获取最新插件列表和版本）：

   ```
   /marketplace update jacob-omp-collections
   ```

2. **安装特定版本**（可选，重新安装获取最新代码）：
   ```
   /marketplace install aicodegather@jacob-omp-collections
   ```

OMP **没有**自动更新机制——需要用户手动 `/marketplace update` 并重新安装。

## Dev 模式（本地开发）

安装时用 `path:` 前缀引用本地路径：

```
/marketplace install path:/Users/xxx/jacob-omp-collections/packages/aicodegather
```

Dev 模式会直接 symlink 到本地开发目录，代码修改后重启 OMP 即可生效。^[inferred]

取消 dev 模式需要先：

```
/marketplace uninstall aicodegather@jacob-omp-collections
```

再按常规方式安装。

## 卸载插件

```
/marketplace uninstall aicodegather@jacob-omp-collections
```

## 约束

- Skills 和 MCP server **不能**通过 Marketplace 插件分发，只能通过本地 symlink/merge 安装
- Marketplace 的 name 和 owner 顶层字段不能修改
- 插件需要 `package.json` 中声明 `omp.extensions` 字段

## 常见问题

### Marketplace 与 npm 插件共存冲突

通过 `npm install @jacob-z/aicodegather` 和 `/marketplace install aicodegather@jacob-omp-collections` 安装同一插件会导致重复。两者独立管理：

- npm 安装写入 `~/.omp/plugins/package.json` 的 dependencies
- marketplace 安装写入 `~/.config/omp/installed_plugins.json`

清理方法见 [[projects/jacob-omp-collections/skills/plugin-config-debugging|插件配置调试]]。

### Marketplace 本质是 Claude 兼容层

Marketplace 的设计初衷是为 Claude Code 生态的插件提供适配。OMP 原生推荐使用 npm 方式安装插件（`omp install @jacob-z/aicodegather`）。Marketplace 安装方式在某些场景下可能存在加载顺序或版本同步问题。^[inferred]
