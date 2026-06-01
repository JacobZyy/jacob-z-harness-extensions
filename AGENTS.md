# AGENTS.md

## 项目结构

OMP 插件集合。插件通过 npm（`omp install`）或 marketplace 分发。

```
jacob-omp-collections/
  .claude-plugin/
    marketplace.json          ← Marketplace 索引
  packages/
    aicodegather/             ← Extension 插件（AI code edit tracking）
      package.json            ← name: @jacob-z/aicodegather, omp.extensions
      src/index.ts            ← Extension 入口
    oxlint-gate/              ← Extension 插件（type assertion gate）
      package.json            ← name: @jacob-z/oxlint-gate, omp.extensions
      src/index.ts
```

## 安装

```bash
# 方式 1：npm install（推荐，自动处理 node_modules）
omp install @jacob-z/aicodegather
omp install @jacob-z/oxlint-gate

# 方式 2：marketplace install（需要手动 symlink）
/marketplace add JacobZyy/jacob-omp-collections
/marketplace install aicodegather@jacob-omp-collections
```

## 添加插件

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

4. 在 `.claude-plugin/marketplace.json` 的 `plugins` 追加：

```json
{
  "name": "<plugin-name>",
  "description": "描述",
  "source": "./packages/<plugin-name>"
}
```

5. 提交推送 + `npm publish`

## 发布流程

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
- 不要在 `packages/` 下放非插件内容
- Extension 插件通过 `omp.extensions` 字段注册，不是 skills/hooks/commands
- npm publish 时需要代理：`export https_proxy=http://127.0.0.1:7890`

## 开发校验

每次开发完成后，MUST 按顺序执行以下步骤：

1. **lint:fix**：`bun run lint:fix`。仍有报错则手动修复后重新执行，直到零报错。
2. **单测**：`bunx vitest run`（根目录执行，自动扫描 `packages/*/src/**/*.test.ts`）。失败则修复后重新执行，直到全部通过。
