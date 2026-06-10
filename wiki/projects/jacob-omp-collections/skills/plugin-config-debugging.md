---
title: OMP 插件配置调试
category: skills
tags: [omp, plugin, debugging, configuration, troubleshooting]
summary: OMP 插件配置常见问题排查：lock 文件缺失、key 不匹配、marketplace 与 npm 插件冲突。
sources: [omp-sessions-20260531]
provenance:
  extracted: 0.60
  inferred: 0.35
  ambiguous: 0.05
base_confidence: 0.42
lifecycle: draft
lifecycle_changed: 2026-06-01
created: 2026-06-01T12:00:00Z
updated: 2026-06-01T12:00:00Z
---

# OMP 插件配置调试

排查 OMP 插件加载、启用/禁用、以及 marketplace 与 npm 插件共存时的常见问题。

## 核心文件

| 文件 | 路径 | 作用 |
|------|------|------|
| package.json | `~/.omp/plugins/package.json` | 声明所有已安装插件的依赖 |
| lock 文件 | `~/.omp/plugins/omp-plugins.lock.json` | 记录插件运行时状态（enabled/disabled） |
| installed_plugins.json | `~/.config/omp/installed_plugins.json` | marketplace 安装记录 |
| marketplaces.json | `~/.config/omp/marketplaces.json` | marketplace 源配置 |

## 问题 1：Settings 中部分插件不可见或 Toggle 报错

**症状**：OMP Settings 界面只显示部分插件，切换 enabled 状态时抛出异常。

**根因**：`omp-plugins.lock.json` 中缺少对应插件的条目，或 key 名与 `package.json` 中的 npm 包名不匹配。

**关键代码路径**：
```
PluginSettingsComponent.#showPluginList()
  -> new PluginManager(cwd).list()
    -> 读取 ~/.omp/plugins/package.json 的 dependencies
    -> 遍历每个，读 node_modules/<name>/package.json
    -> 有 omp 或 pi manifest 的都会加入结果
    -> 返回 InstalledPlugin[]
```

`list()` 方法从 `package.json` 的 dependencies 遍历发现插件，但 `setEnabled()` 查的是 `omp-plugins.lock.json` 的 `plugins` 对象。如果某个插件不在 lock 文件中，`list()` 会 fallback 给它一个默认 enabled 状态，但 toggle 时会报错。

**修复方法**：在 `omp-plugins.lock.json` 的 `plugins` 对象中添加缺失的条目，key 必须与 npm 包名完全一致（如 `@jacob-z/aicodegather`），version 匹配已安装版本。

```json
{
  "plugins": {
    "@jacob-z/aicodegather": {
      "version": "1.6.0",
      "enabled": true
    }
  }
}
```

**注意**：修改后需要重启 OMP session 才能生效，因为 PluginManager 在 session 启动时缓存配置。

## 问题 2：Marketplace 插件与 npm 插件重复

**症状**：同一插件同时出现在 `npm plugins` 和 `marketplace plugins` 列表中。

**原因**：通过 `npm install` 安装的插件会写入 `~/.omp/plugins/package.json` 的 dependencies；通过 `/marketplace install` 安装的会写入 `installed_plugins.json`。两者独立管理，互不感知。

**解决方案**：
- 如果只需要 npm 方式管理：清理 `installed_plugins.json` 中的对应条目，并删除 `~/.omp/plugins/node_modules/@[[projects/jacob-omp-collections/jacob-omp-collections]]/` 目录
- 如果只需要 marketplace 方式：从 `package.json` 的 dependencies 中移除对应包

## 问题 3：Marketplace 安装后插件不加载

**症状**：`/marketplace install` 执行成功，但插件未在 session 中生效。

**排查步骤**：
1. 检查 `~/.config/omp/installed_plugins.json` 是否有记录
2. 检查 `~/.omp/plugins/node_modules/` 下是否有对应的 symlink 或目录
3. 检查插件的 `package.json` 是否声明了 `omp.extensions` 或 `pi.extensions`
4. 重启 OMP session 后再验证

## 相关页面

- [[projects/jacob-omp-collections/entities/aicodegather]]
- [[projects/jacob-omp-collections/entities/oxlint-gate]]
- [[projects/jacob-omp-collections/concepts/marketplace-system]]
- [[projects/jacob-omp-collections/concepts/plugin-architecture]]
