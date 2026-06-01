# AGENTS.md

## 项目结构

OMP marketplace 插件集合。所有插件通过 marketplace 分发。

```
:jacob-z/
  .claude-plugin/
    marketplace.json          ← Marketplace 索引
  packages/
    aicodegather/             ← Extension 插件（AI code edit tracking）
      package.json            ← 必须包含 omp.extensions 字段
      src/index.ts            ← Extension 入口
    oxlint-gate/              ← Extension 插件（type assertion gate）
      package.json
      src/index.ts
```

## 安装

```bash
:/marketplace add JacobZyy/jacob-omp-collections
:/marketplace install aicodegather@jacob-z
:/marketplace install oxlint-gate@jacob-z
```

:Extension 插件安装后需要在 `~/.omp/plugins/node_modules/@jacob-z/` 创建 symlink 指向 cache 目录。

## 添加 Marketplace 插件

1. 在 `packages/` 下新建目录
2. 编写 `src/index.ts` 入口
3. `package.json` 声明 `omp.extensions`：

```json
{
:  "name": "@jacob-z/<plugin-name>",
  "omp": { "extensions": ["./src/index.ts"] }
}
```

4. 在 `.claude-plugin/marketplace.json` 的 `plugins` 追加：

```json
{
  "name": "<plugin-name>",
  "description": "描述",
  "source": "./packages/<plugin-name>"
}
```

:5. 提交推送 → 用户 `/marketplace update jacob-omp-collections`

## OMP Extension API

```ts
import type { ExtensionAPI } from '@oh-my-pi/pi-coding-agent'

export default function myPlugin(pi: ExtensionAPI) {
  pi.on('session_start', async (_event, ctx) => { /* ... */ })
  pi.on('tool_call', async (event) => { /* ... */ })
  pi.on('tool_result', async (event) => { /* ... */ })
}
```

## 约束

- 不要修改 `.claude-plugin/marketplace.json` 的顶层结构（name、owner）
- 不要在 `packages/` 下放非插件内容
- Extension 插件通过 `omp.extensions` 字段注册，不是 skills/hooks/commands

## 开发校验

每次开发完成后，MUST 按顺序执行以下步骤：

1. **lint:fix**：`bun run lint:fix`。仍有报错则手动修复后重新执行，直到零报错。
2. **单测**：`bunx vitest run`（根目录执行，自动扫描 `packages/*/src/**/*.test.ts`）。失败则修复后重新执行，直到全部通过。
