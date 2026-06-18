# opencode-oxc-lint 设计笔记

> 自用文档，跨会话参考。记录现状、痛点、方案设计。

## 一、当前现状

### 架构：即时模式（v0.4.0 开发中）

- **触发点**：`tool.execute.after` hook（每次 edit/write/apply_patch 后即时触发）
- **pipeline 顺序**：oxfmt（format）→ oxlint --fix（auto-fix）→ oxlint（check 剩余诊断）
- **诊断注入**：剩余诊断追加到 `output.output`，LLM 在当前轮次 tool result 里直接可见
- **通知**：TUI `showToast`（fire-and-forget，非阻塞）
  - plugin loaded → info（延迟 2 秒，等 TUI 就绪）
  - pipeline clean → success
  - pipeline 有诊断 → warning
- **日志**：`writeLocalLog` → `~/.local/state/opencode-oxc-lint/opencode-oxc-lint.log`
- **防循环**：per-file-per-session `maxHints` 计数（默认 3），达上限后 skip

### 配置体系（当前）

- **user 级**：`~/.config/opencode/jacob-z-harness-opencode.json` → `oxc-lint` 字段
- 字段：`oxlintBin`, `configPath`, `oxfmtBin`, `extensions`, `maxLines`, `log`, `logPath`, `maxHints`
- 读取：`normalizeOptions()` 合并 harness 配置 + plugin options

### 打包

- **tsdown**（esm/node/dts，external `@opencode-ai/*`）
- `package.json` 须有 `main` + `exports.import`（否则 opencode 本地路径加载失败）
- npm: `@jacob-z/opencode-oxc-lint`

---

## 二、痛点

### 核心痛点：Lint 反馈闭环

**原始场景**：
1. lint 报错注入对话
2. AI 看到诊断 → 尝试修
3. 但某些场景用户希望 AI 忽略（不修）
4. AI 忽略/修不掉 → 下次 edit 再注入 → 再处理 → **无限闭环**

### 当前 maxHints 的不足

- **只增不减**：clean 不归零，累计达限后永久 skip（即使后来引入新错误）
- **不区分错误是否变化**：同一错误和"修了一半产生新错误"无法区分
- **无忽略机制**：无法配置"某些文件不注入诊断"

---

## 三、要解决的问题

1. **可控忽略**：用户某些场景不想 AI 修 lint（按文件通配符 + 全局模式）
2. **防闭环**：忽略或修不掉时，不能无限循环

---

## 四、确定的方案

### 4.1 处理模式 `mode`

| mode | 诊断注入 output.output | 行为 | 适用 |
|------|----------------------|------|------|
| `fix`（默认）| ✓ 原文 | AI 尝试修 | 欲 AI 自动修 |
| `notify` | ✓ 加前缀 `[oxc-lint: informational, no fix needed]` | AI 见到但标记无需修 | 欲知 lint 但不想修 |
| `silent` | ✗ 仅日志+toast | AI 看不到 | 彻底忽略 |

### 4.2 忽略规则 `ignore`（文件通配符，Bun.Glob 原生）

```json
{ "oxc-lint": { "mode": "fix", "ignore": ["**/*.test.ts", "dist/**", "src/generated/**"] } }
```

- glob 数组，匹配的文件**强制 silent**（跳过 pipeline，不注入、不计数）
- 优先级最高，覆盖 mode
- 实现用 `Bun.Glob`：`new Bun.Glob(pattern).match(path)` → boolean

### 4.3 指纹去重防闭环（替代简单 maxHints）

每文件维护 `{ fingerprint, count }`：
- 诊断指纹（hash）**未变**（AI 修不掉/忽略了）→ count++，达 maxHints 后不再注入
- 诊断指纹**变了**（部分修复/新错误）→ count 归 1，重新注入
- 诊断**消失**（clean）→ 清除记录

### 4.4 配置两级合并（user + 项目级）

| 级别 | 路径 | 优先级 |
|------|------|--------|
| user | `~/.config/opencode/jacob-z-harness-opencode.json`（已有）| 低 |
| 项目级 | `<cwd>/.jacob-z/jacob-z-harness-opencode.json`（仓库 .jacob-z 目录下）| 高 |

合并规则：标量后者覆盖；数组（ignore）取并集。

---

## 五、实施细节（三文件改动）

### 5.1 config.ts

**新增字段**（OxcLintOptions + NormalizedOptions）：
```ts
mode?: 'fix' | 'notify' | 'silent'   // OxcLintOptions
ignore?: string[]
// NormalizedOptions 去掉 ?，带默认值
mode: 'fix' | 'notify' | 'silent'
ignore: string[]
```

**isOxcLintOptions 校验**追加：
```ts
&& (value.mode === undefined || ['fix','notify','silent'].includes(value.mode))
&& (value.ignore === undefined || isStringArray(value.ignore))
```

**normalizeOptions 加 cwd 参数 + 两级读取**：
```ts
export function normalizeOptions(options: OxcLintOptions = {}, cwd = process.cwd()): NormalizedOptions {
  const userOptions = readHarnessOptions()
  const projectOptions = readHarnessOptions(join(cwd, '.jacob-z', 'jacob-z-harness-opencode.json'))
  const merged = { ...userOptions, ...projectOptions, ...options }

  // ignore 数组取并集
  const ignore = [
    ...(userOptions.ignore ?? []),
    ...(projectOptions.ignore ?? []),
    ...(options.ignore ?? []),
  ]

  return {
    ...merged,
    mode: merged.mode ?? 'fix',
    ignore,
    // 其他字段不变
  }
}
```

**调用点补 cwd**：handleToolAfter 传 `ctx.cwd`、createCollector 传 `ctx.cwd`。

### 5.2 resolve.ts

**新增 matchesIgnore 函数**：
```ts
import { relative } from 'node:path'

export function matchesIgnore(filePath: string, cwd: string, patterns: string[]): boolean {
  if (patterns.length === 0) return false
  const rel = isAbsolute(filePath) ? relative(cwd, filePath) : filePath
  return patterns.some((p) => {
    const g = new Bun.Glob(p)
    return g.match(rel) || g.match(filePath)
  })
}
```

### 5.3 index.ts

**hintCounts 升级为 hintStates**（指纹 + 计数）：
```ts
interface HintState { fingerprint: number; count: number }
const hintStates = new Map<string, Map<string, HintState>>()
```

**hashDiagnostics**（djb2，不依赖外部库）：
```ts
function hashDiagnostics(msg: string): number {
  let h = 5381
  for (let i = 0; i < msg.length; i++) h = ((h << 5) + h + msg.charCodeAt(i)) | 0
  return h
}
```

**handleToolAfter 核心循环**改造：
```ts
for (const file of files) {
  // 1. ignore 跳过
  if (matchesIgnore(file, ctx.cwd, resolvedOptions.ignore)) continue

  // 2. 跑 pipeline
  const result = await runPipelineForFile(file, ...)
  filesProcessed++

  // 3. clean → 清除指纹
  if (!result.message) { stateMap.delete(file); continue }

  filesWithDiagnostics++
  const fingerprint = hashDiagnostics(result.message)
  const prev = stateMap.get(file)

  // 4. 指纹去重
  if (prev && prev.fingerprint === fingerprint) {
    prev.count++
    if (prev.count > resolvedOptions.maxHints) continue   // 同错误超限 → skip
  } else {
    stateMap.set(file, { fingerprint, count: 1 })          // 变了/首次 → 重置
  }

  // 5. 按 mode 注入
  if (resolvedOptions.mode === 'silent') continue
  const prefix = resolvedOptions.mode === 'notify'
    ? '[oxc-lint: informational, no fix needed]'
    : '[oxc-lint]'
  output.output += `\n\n${prefix} ${file}:\n${result.message}`
}
```

---

## 六、配置示例

user 级 `~/.config/opencode/jacob-z-harness-opencode.json`：
```json
{ "oxc-lint": { "mode": "fix", "maxHints": 3, "ignore": ["dist/**"] } }
```

项目级 `<cwd>/.jacob-z/jacob-z-harness-opencode.json`：
```json
{ "oxc-lint": { "ignore": ["**/*.test.ts", "src/generated/**"] } }
```

合并结果：`mode=fix, maxHints=3, ignore=["dist/**", "**/*.test.ts", "src/generated/**"]`

---

## 七、版本历史

| 版本 | 状态 | 核心改动 |
|------|------|----------|
| 0.1.x | 已发 | session.idle 批量 pipeline |
| 0.2.0 | 已发 | tsdown 打包 + package.json 修复 |
| 0.3.0 | 已发 | 即时模式 tool.execute.after + maxHints 计数 |
| 0.4.0 | 已发 | TUI toast 通知（fire-and-forget）|
| 0.5.0 | 已实施 | mode + ignore glob + 指纹去重防闭环 + 两级配置 |

---

## 八、0.5.0 实施记录

按第五章三文件改动落地，以下为与原设计方案的差异/补充：

1. **glob 匹配的运行时兼容**
   - 设计文档统一用 `Bun.Glob`。实际 `matchesIgnore` 优先 `Bun.Glob`，当 `typeof Bun === 'undefined'`（如 vitest 的 node worker）时 fallback 到内置 `regexFromGlob`（支持 `**` / `*` / `?`）。
   - 原因：vitest worker 无 `Bun` 全局，直接 `new Bun.Glob()` 会在测试期 `ReferenceError`。opencode 运行时（bun）仍走 `Bun.Glob`，语义不变。

2. **指纹去重语义**
   - maxHints 判断从"跑 pipeline 前"改为"跑 pipeline 后"：必须先拿到本轮诊断才能算指纹、判断是否变化。
   - 副作用：即使已达上限，pipeline 仍会跑一次（为检测指纹是否变化）。oxlint 足够快，可接受。
   - `filesWithDiagnostics` 在指纹命中"同错误超限"仍 +1（文件确实有诊断，只是不再注入），toast 仍显示 warning。

3. **类型纪律**
   - `isOxcLintMode` 用 `ReadonlySet<string>` + 类型守卫收窄，避免 `as OxcLintMode` 断言。
   - `mode` 校验接入 `isOxcLintOptions`，非法值（如 `mode: "bogus"`）会被忽略。

4. **测试隔离**
   - `config.test.ts` 引入 `beforeEach` stub `HOME` 到临时空目录，隔离开发者本机 `~/.config/opencode/jacob-z-harness-opencode.json` 对 `normalizeOptions()` 默认值断言的污染。
