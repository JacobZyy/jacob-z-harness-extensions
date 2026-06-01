# AGENTS.md

## 项目结构

OMP 插件仓库，包含两条完全独立的分发轨道：

```
jacob-omp-collections/
  .claude-plugin/
    marketplace.json              ← Marketplace 索引（只指向 marketplace-share）
  packages/
    aicodegather/                 ← Extension 轨道 — AI code edit tracking
      package.json                ← name: @jacob-z/aicodegather, omp.extensions
      src/index.ts                ← Extension 入口
    oxlint-gate/                  ← Extension 轨道 — type assertion gate
      package.json                ← name: @jacob-z/oxlint-gate, omp.extensions
      src/index.ts
    marketplace-share/            ← Marketplace 轨道 — 共享内容
      .mcp.json                   ← MCP server 配置
      skills/                     ← Marketplace skills
      hooks/                      ← Marketplace hooks
```

## 两条分发轨道

### Extension 轨道（npm）

通过 `package.json` deps + `omp.extensions` 字段注册，走 npm publish。

```bash
omp install @jacob-z/aicodegather
omp install @jacob-z/oxlint-gate
```

- `aicodegather` 和 `oxlint-gate` 走此轨道
- 发布到 npm，用户通过 `omp install` 安装
- 不需要在 `marketplace.json` 中注册

### Marketplace 轨道（Claude Code 兼容层）

通过 `installed_plugins.json` → cache 目录 → 纯文件系统扫描发现。

```bash
/marketplace add JacobZyy/jacob-omp-collections
/marketplace install marketplace-share@jacob-omp-collections
```

- `packages/marketplace-share/` 走此轨道
- 放置 skills、hooks、MCP 配置等纯文件内容
- 通过 `.claude-plugin/marketplace.json` 索引
- marketplace 发现约定：`skills/`、`hooks/`、`commands/`、`tools/`、`.mcp.json`

两条轨道不交叉，各自独立安装和分发。

## 添加 Extension 插件

1. 在 `packages/` 下新建目录
2. 编写 `src/index.ts` 入口
3. `package.json` 声明 `omp.extensions`：

```json
{
  "name": "@jacob-z/<plugin-name>",
  "omp": { "extensions": ["./src/index.ts"] },
  "files": ["src"]
}
```

4. 提交推送 + `npm publish --access public`

Extension 插件不需要在 `marketplace.json` 中注册。

## 添加 Marketplace 内容

1. 在 `packages/marketplace-share/` 对应目录下添加文件（`skills/`、`hooks/`）
2. 如有 MCP server 配置，编辑 `packages/marketplace-share/.mcp.json`
3. 提交推送即可，无需 npm publish

## 发布流程（Extension 轨道）

1. 更新 `packages/<plugin>/package.json` 的 `version`
2. `bunx vitest run` 确保测试通过
3. `git add -A && git commit -m "chore: release <plugin>@<version>" && git push`
4. `cd packages/<plugin> && npm publish --access public`
5. 用户端：`omp install @jacob-z/<plugin>@<version>`

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
- Extension 插件（aicodegather、oxlint-gate）只走 npm，不在 marketplace.json 中注册
- Marketplace 内容只放在 `packages/marketplace-share/` 下
- npm publish 时需要代理：`export https_proxy=http://127.0.0.1:7890`

## 开发校验

每次开发完成后，MUST 按顺序执行以下步骤：

1. **lint:fix**：`bun run lint:fix`。仍有报错则手动修复后重新执行，直到零报错。
2. **单测**：`bunx vitest run`（根目录执行，自动扫描 `packages/*/src/**/*.test.ts`）。失败则修复后重新执行，直到全部通过。
