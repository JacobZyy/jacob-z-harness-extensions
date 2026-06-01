# AGENTS.md — marketplace-share

## 定位

`packages/marketplace-share/` 是 OMP Marketplace 轨道的共享内容包。存放 skills、hooks、MCP server 配置等纯文件内容，通过 marketplace 分发。

与 Extension 轨道（npm publish，如 `@jacob-z/aicodegather`）完全独立。本包不走 npm。

## 目录约定

```
packages/marketplace-share/
  .mcp.json               ← MCP server 配置（marketplace 发现约定）
  skills/                  ← Marketplace skills（.md 文件）
  hooks/                   ← Marketplace hooks
```

Marketplace 发现约定扫描：`skills/`、`hooks/`、`commands/`、`tools/`、`.mcp.json`。

## 安装方式

```bash
/marketplace add JacobZyy/jacob-omp-collections
/marketplace install marketplace-share@jacob-omp-collections
```

## 添加内容

### 添加 Skill

在 `skills/` 下创建 `.md` 文件，遵循 OMP skill 格式。

### 添加 Hook

在 `hooks/` 下创建 hook 文件。

### 配置 MCP Server

编辑 `.mcp.json`，在 `mcpServers` 中添加 server 配置。

## 约束

- 不要在此目录放置 Extension 代码（Extension 走 npm，放在 `packages/<name>/`）
- 内容提交即生效，无需 npm publish
- 保持 `.mcp.json` 格式合法（即使 `mcpServers` 为空对象）
