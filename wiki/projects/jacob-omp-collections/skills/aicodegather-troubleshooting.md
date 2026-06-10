---
title: aicodegather 排查记录
category: skills
tags: [aicodegather, debugging, omp, troubleshooting, oxlint-gate]
aliases: [aicodegather 调试, OMP 插件排查]
sources:
  - packages/aicodegather/TROUBLESHOOTING.md
  - ~/.omp/agent/sessions/-Documents-workspace-jacob-open-source-oh-my-pi/
  - ~/.omp/agent/sessions/-Documents-workspace-jacob-open-source-[[projects/jacob-omp-collections/jacob-omp-collections|jacob-omp-collections]]/
  - packages/oxlint-gate/src/[[index]].ts
  - [[projects/jacob-omp-collections/concepts/installation-and-deployment|install.sh]]
summary: >-
  OMP Extension 的历史问题排查——从 Claude Code hooks 迁移到 OMP Extension 遇到的一系列问题，以及 marketplace 安装和路径处理的踩坑记录。
provenance:
  extracted: 0.85
  inferred: 0.15
  ambiguous: 0.0
base_confidence: 0.75
lifecycle: draft
lifecycle_changed: 2026-05-31
created: 2026-05-31T02:30:00Z
updated: 2026-05-31T06:00:00Z
---

# OMP Extension 排查记录

> 基于 TROUBLESHOOTING.md、[[projects/jacob-omp-collections/entities/oxlint-gate|oxlint-gate]] 开发经验和 OMP 源码分析整理。

## 一、插件加载机制（关键）

### OMP 如何发现插件

```
getEnabledPlugins() 读取 ~/.omp/plugins/package.json#dependencies
  ↓
遍历 dependencies 中的每个包名
  ↓
检查 node_modules/<包名>/package.json 是否存在
  ↓
读取 package.json 中的 `omp.extensions` 字段
  ↓
加载 extension 模块
```

**关键发现**：`installed_plugins.json` 只是安装记录，OMP 实际从 `package.json#dependencies` 发现插件。

### 必须同步的三个文件

| 文件                                      | 作用               | 不同步的后果   |
| ----------------------------------------- | ------------------ | -------------- |
| `~/.omp/plugins/package.json`             | OMP 发现插件的入口 | 插件不加载     |
| `~/.omp/plugins/node_modules/@scope/name` | 实际的插件代码     | symlink 断开   |
| `~/.omp/plugins/cache/plugins/...`        | 插件的缓存目录     | 安装路径不存在 |

## 二、[[projects/jacob-omp-collections/concepts/marketplace-system|marketplace]] 安装踩坑

### 问题：[[projects/jacob-omp-collections/concepts/marketplace-system|marketplace]] install 后插件不加载

**原因**：`omp plugin install` 命令只做了：

1. 下载插件到 `cache/plugins/`
2. 更新 `installed_plugins.json`
3. 创建 symlink 到 `node_modules/`

但**没有更新 `package.json#dependencies`**，导致 `getEnabledPlugins()` 发现不了插件。

**修复**：`install.sh --fix-links` 现在同时修复 symlink 和 package.json：

```bash
# 修复命令
cd jacob-omp-collections
bash install.sh --fix-links
```

### 修复脚本核心逻辑

```python
# 从 installed_plugins.json 读取已安装插件
# 同步到 package.json#dependencies
for plugin_id, versions in plugins.items():
    name, scope = plugin_id.split("@")
    pkg_name = f"@{scope}/{name}"

    # 1. 确保 symlink 存在
    if not os.path.islink(symlink_path):
        os.symlink(install_path, symlink_path)

    # 2. 确保 package.json 有依赖
    if pkg_name not in pkg["dependencies"]:
        pkg["dependencies"][pkg_name] = version
```

## 三、路径处理踩坑

### 问题：`~` 未展开导致路径错误

**现象**：日志显示路径拼接错误

```
/Users/jacobzha/Documents/workspace/jacob-open-source/oh-my-pi/~/Documents/...
```

**原因**：OMP 提供的路径可能是 `~/Documents/...` 格式，`path.isAbsolute('~/...')` 返回 `true`，但 `~` 不会被 Node.js 自动展开。

**修复**：添加 `expandTilde()` 函数

```typescript
function expandTilde(p: string): string {
  if (p === '~' || p.startsWith('~/')) {
    return join(HOME, p.slice(1))
  }
  return p
}

// 使用
const expandedPath = expandTilde(extractedPath)
const filePath = isAbsolute(expandedPath) ? expandedPath : resolve(ctx.cwd, expandedPath)
```

## 四、[[projects/jacob-omp-collections/entities/aicodegather|aicodegather]] 历史问题

### tool_call / tool_result 事件未触发

**已确认的结论**：

1. 插件代码本身没有问题 ✅ — 模拟测试完全通过（13 个集成测试）
2. 最可能是 symlink 状态不一致：`installed_plugins.json`、`package.json deps`、symlink target 三者版本不匹配
3. `session_start` 能触发但 `tool_call` 不能 → `ExtensionToolWrapper.execute()` 中 `hasHandlers("tool_call")` 返回 false

### post_edit 找不到 pre_edit 缓存

**原因**：`extractFilePath()` 在 `tool_call` 和 `tool_result` 阶段返回的路径格式不一致。

**当前状态**：1.4.3 版本中使用了 `extractFilePath()` + `isAbsolute ? resolve(ctx.cwd, ...)` 处理，但 `ctx.cwd` 在 tool_result 阶段可能不可用。

## 五、事件触发链路（OMP 源码追踪）

```
工具执行:
  sdk.ts:1526 → toolRegistry.set(...new ExtensionToolWrapper(tool, extensionRunner))
  wrapper.ts:106 → ExtensionToolWrapper.execute(toolCallId, params, ...)
  wrapper.ts:146 → if (this.runner.hasHandlers("tool_call"))
  wrapper.ts:148 → await this.runner.emitToolCall({...})
  runner.ts:614 → emitToolCall() 遍历 this.extensions → ext.handlers.get("tool_call")
  loader.ts:138 → ConcreteExtensionAPI.on(event, handler) 存入 extension.handlers Map

session_start 触发（交互模式）:
  extension-ui-controller.ts:234 → extensionRunner.initialize(...)
  extension-ui-controller.ts:242 → await extensionRunner.emit({ type: "session_start" })
```

同一个 `extensionRunner` 实例贯穿全程（sdk.ts 创建 → 传至 AgentSession → 传至 ExtensionToolWrapper）。

## 六、loadLegacyPiModule 机制

OMP 不会直接 import 插件源文件，而是：

1. 读源文件文本
2. 重写 imports（`@oh-my-pi/*` → 本地路径，相对路径 → 镜像路径，bare imports → 解析路径）
3. 写入 `/tmp/omp-legacy-pi-file/` 临时文件
4. `import(mirroredPath + ?mtime=...)` 加载镜像文件

这个重写过程**不影响 export default 的值**，仅改 import 路径。`import type` 在运行时完全擦除。

## 七、日志时间线

| 时间                   | 插件         | 版本         | 状态                                                    |
| ---------------------- | ------------ | ------------ | ------------------------------------------------------- |
| 2026-05-29 08:04-08:44 | aicodegather | v1.3.0       | Log 正常触发，但 edit 的 filePath 提取总是 undefined    |
| 2026-05-29 08:50-      | aicodegather | v1.4.3/1.5.0 | session_start 能触发，但 tool_call/tool_result 日志消失 |
| 2026-05-29 10:30+      | aicodegather | v1.5.0       | 全链路正常，日志完整                                    |
| 2026-05-31 02:11       | oxlint-gate  | v1.0.0       | 插件安装，但未加载                                      |
| 2026-05-31 05:34       | oxlint-gate  | v1.0.0       | 修复 package.json 后加载成功                            |
| 2026-05-31 05:37       | oxlint-gate  | v1.0.0       | 修复 ~ 展开后拦截功能正常                               |

## 相关页面

- [[projects/jacob-omp-collections/concepts/marketplace-system]] — OMP Marketplace 系统
- [[projects/jacob-omp-collections/concepts/marketplace-install-deep-dive]] — Marketplace 安装机制深入理解
- [[projects/jacob-omp-collections/entities/aicodegather]] — aicodegather 插件
- [[projects/jacob-omp-collections/entities/oxlint-gate]] — oxlint-gate 插件
