# opencode-oxc-lint E2E 测试设计

> 在真实 opencode 运行时验证 0.5.0 新功能。文档先写设计，执行后回填「实际」栏。

## 一、目标

验证四项新能力在端到端（非单测 mock）下生效：

1. `mode`（fix / notify / silent）—— 诊断注入 output 的形态
2. `ignore` glob —— 匹配文件跳过整条 pipeline
3. 指纹去重防闭环 —— 同错误达 `maxHints` 停注；错误变化重置；clean 清除
4. 两级配置合并 —— user + `<cwd>/.jacob-z/` 合并（标量覆盖、ignore 并集）

## 二、环境前提

| 项 | 值 | 状态 |
|---|---|---|
| opencode plugin 注册 | `packages/opencode-oxc-lint/`（目录）→ 走 `package.json` exports → `dist/index.mjs` | ✓ |
| 新代码已 build 到 dist | `bun run build` 后 `dist/index.mjs` 含 `hintStates`/`matchesIgnore`/`informational` | ✓（需重启 opencode 加载） |
| oxlint 二进制 | `/Users/jacobzha/.bun/bin/oxlint` 1.68.0 | ✓ |
| oxfmt 二进制 | `/Users/jacobzha/.bun/bin/oxfmt` 0.53.0 | ✓ |
| oxlintrc | `~/.config/oxc/oxlintrc.json`：correctness=error, no-debugger=error, eqeqeq=error, no-unused-vars=error | ✓ |
| user harness config | `~/.config/opencode/jacob-z-harness-opencode.json` → 当前仅 `{ configPath }` | ✓ |
| 日志 | `~/.local/state/opencode-oxc-lint/opencode-oxc-lint.log` | ✓ |

**关键时序**：opencode 进程在启动时 `import dist/index.mjs` 并缓存。改 src 后必须 `bun run build` + **重启 opencode** 才生效。改 harness 配置文件（mode/ignore/maxHints）则**无需重启**——`normalizeOptions` 每次 `tool.execute.after` 都重读盘。

## 三、测试机制

- **触发**：用 `write`/`edit` 工具写 `.ts` 文件 → 触发 `tool.execute.after` hook。
- **注入观察点**：tool result 的 `output` 字段里是否出现：
  - `[oxc-lint]`（fix）
  - `[oxc-lint: informational, no fix needed]`（notify）
  - 都不出现（silent / ignored / 去重跳过）
- **日志观察点**：`tail` 日志文件，看 `action` 字段：`check`（有诊断）/ `fix`（clean）/ `skip`（ignored 或 maxHints）/ `error`。
- **配置切换**：直接改 user 或 project harness config 的 `oxc-lint` 字段，下一次 edit 即生效。

## 四、测试产物隔离

- 测试目录：`packages/opencode-oxc-lint/e2e-tmp/`（加 `.gitignore`，测完整体删除）。
- 文件名**避开** `*.test.ts` / `*.spec.ts`（会被 `filterLintableFiles` 的 test-like 正则过滤）。
- 文件保持小（远小于 `maxLines=2000`）。

## 五、错误构造策略

pipeline 是 `oxfmt → oxlint --fix → oxlint check`。要保证 check 阶段**仍有残留诊断**，必须选 `--fix` **不会自动修掉**的错误：

| 构造 | 规则 | --fix 是否修掉 | 可用 |
|---|---|---|---|
| `debugger;` | no-debugger(error) | 不修（oxlint 不自动删 debugger） | ✓ 首选 |
| `const a = 1` 后不用 | no-unused-vars | **会修**（--fix 删声明） | ✗ |
| `a == b` | eqeqeq | **会修**（改成 ===） | ✗ |
| 重复声明等 | 视规则 | 不确定 | 备选 |

**统一采用 `debugger;` 作为诊断源**，确保 check 残留稳定。测试前会先用 oxlint 单独验证 `--fix` 不删 `debugger`。

## 六、用例

### T1 · fix 模式（默认）注入诊断
- **配置**：user config 不设 mode（默认 fix）
- **动作**：`write e2e-tmp/t1.ts` 内容 `debugger;\n`
- **期望**：tool output 含 `[oxc-lint]` + 文件名 + no-debugger 诊断；日志出现 `action:"check"`
- **实际**：✅ **通过**。`write` 返回的 output 注入：
  ```
  [oxc-lint] /Users/.../e2e-tmp/t1.ts:
  x eslint(no-debugger): `debugger` statement is not allowed
    ,-[packages/opencode-oxc-lint/e2e-tmp/t1.ts:1:1]
    1 | debugger;
    help: Remove the debugger statement
  ```
  管线 oxfmt→oxlint --fix→oxlint check 端到端通畅；`debugger;` 经 `--fix` 仍残留、check 报 no-debugger、按 fix 模式注入。fix 注入行为新旧版一致，结论可迁移（新版复测确认）。

### T2 · notify 模式
- **配置**：user config `oxc-lint.mode = "notify"`
- **动作**：`write e2e-tmp/t2.ts` 内容 `debugger;\n`
- **期望**：output 含 `[oxc-lint: informational, no fix needed]`
- **实际**：✅ **通过**。探测文件 `probe-notify.ts` 的 output 出现 `[oxc-lint: informational, no fix needed] ... no-debugger`。同时佐证当前进程已加载 0.5.0 新 dist（notify 分支为新代码独有）。

### T3 · silent 模式（不注入但 pipeline 仍跑）
- **配置**：user config `oxc-lint.mode = "silent"`
- **动作**：`write e2e-tmp/t3.ts` 内容 `debugger;\n`
- **期望**：output **不含** oxc-lint；日志仍有 `action:"check"`（pipeline 跑了，只是 mode=silent 不注入）
- **实际**：✅ **通过**。`write t3-silent.ts` output 干净（仅 `Wrote file successfully.`）。日志：`action:"check", exitCode:1, summary:"remaining diagnostics"`——pipeline 跑了且有诊断，只是 mode=silent 不注入。

### T4 · ignore glob 跳过整条 pipeline
- **配置**：user config `mode=fix` + `ignore=["packages/opencode-oxc-lint/e2e-tmp/ignored/**"]`
- **动作**：`write e2e-tmp/ignored/t4.ts` 内容 `debugger;\n`
- **期望**：output 不含 oxc-lint；日志 `action:"skip"` summary 含 `ignored by glob`；**不跑** pipeline（无 check/fix）
- **实际**：✅ **通过**。output 干净。日志：`action:"skip", summary:"ignored by glob pattern"`，无 check/fix 条目——pipeline 整条跳过。Bun.Glob（bun 运行时）匹配 cwd 相对路径生效。

### T5 · 指纹去重：同错误达 maxHints 后停注
- **配置**：user config `mode=fix` + `maxHints=2`
- **动作**：连续 3 次 `edit e2e-tmp/t5.ts`，每次都保留 `debugger;`（错误指纹不变）
- **期望**：第 1、2 次 output 含诊断；第 3 次 output **不含**（日志 `skip` summary 含 `max hints ... same diagnostics`）
- **实际**：❌ **失败，暴露真实 bug**。第 3 次 `write t5b.ts`（同内容 `debugger;\n` 三次）**仍注入**。根因：oxlint 输出尾行 `Finished in Xms on N files...` 的毫秒数每次不同（实测 3/2/4ms），`hashDiagnostics` 对全文 hash → 指纹每次都变 → 永远走"指纹变化重置 count=1"分支，去重永不触发。单测 mock runner 返回固定文本未覆盖到此。
- **修复**：`hashDiagnostics` 增加预处理——剥离 `Found N warning...` / `Finished in ...` 易变行后再 hash（见第十一章）。已 rebuild + 加防回归单测（`hashDiagnostics` 用例）。
- **复测**：✅ **通过**（重启加载 17:43 修复版后）。同文件 `t5.ts` 三次 `write` 相同 `debugger;\n`：第 1、2 次注入（count=1、2），第 3 次 output 干净。日志确认 `skip: max hints (2) reached, same diagnostics`。指纹剥离 `Finished in Xms` 后三次稳定，去重生效。

### T6 · 指纹变化重置计数
- **配置**：user config `mode=fix` + `maxHints=1`
- **动作**（同一 sessionID 内）：
  1. `write e2e-tmp/t6.ts` = `debugger;\n`（错误A，注入）
  2. `write` 保持 `debugger;\n`（同 A，达上限，不注入）
  3. `write` 改为 `debugger;\ndebugger;\n`（指纹变，重新注入）
- **期望**：第 3 次因指纹变化重新注入
- **实际**：✅ **通过**。动作 1 注入（count=1）；动作 2 同指纹 count=2>1 → skip（output 干净）；动作 3 改为两个 `debugger`，诊断输出变为 2 个 no-debugger + 行 2 → 指纹变 → 重置 count=1 → 重新注入。指纹变化重置逻辑正确。

### T7 · clean 后清除指纹
- **配置**：user config `mode=fix` + `maxHints=1`
- **动作**（同一 sessionID）：
  1. `write e2e-tmp/t7.ts` = `debugger;\n`（注入）
  2. `write` 改为 `export const ok = 1\n`（clean，清指纹记录）
  3. `write` 改回 `debugger;\n`（应注入，因 clean 已清记录）
- **期望**：第 3 次重新注入
- **实际**：❌ **失败，暴露第二个真实 bug**。动作 2 写入 clean 内容 `export const ok = 1;`，output 却被注入：
  ```
  [oxc-lint] .../t7.ts:
  Found 0 warnings and 0 errors.
  Finished in 3ms ...
  ```
  根因：oxlint **即使无诊断也输出 `Found 0 warnings and 0 errors` 统计行**，`runLintForFile` 的 clean 判定 `fixOutput.length === 0` 失效（统计行非空）→ `result.message` 含纯统计行 → `handleToolAfter` 的 `if (!result.message)` 永不成立 → clean 文件被误判有诊断、`stateMap.delete` 永不触发。这直接破坏设计文档 4.3「诊断消失→清除记录」。
- **修复**：`oxlint.ts` 引入 `hasRealDiagnostics`（剥离 `Found/Finished` 统计行后判断是否有实质内容），`runLintForFile` 改用它判 clean；无真实诊断时 `message = undefined`。同时把 `VOLATILE_TAIL_RE` 提为 `oxlint.ts` 导出，`index.ts` 的 `hashDiagnostics` 复用（DRY）。加防回归单测（`treats volatile summary-only output as clean`）。见第十二章。
- **复测**：✅ **通过**（重启加载 18:06 版后）。动作 2 写 clean `export const ok = 1;`：output 干净（不再注入 `Found 0 errors`）+ 日志 `action:"fix", exitCode:0, summary:"clean after pipeline"`（stateMap.delete 触发）；动作 3 写回 `debugger;`：因记录已清，prev=undefined → 重新注入。clean 清指纹功能完整验证。

### T8 · 两级配置合并（project 覆盖 user / ignore 并集）
- **配置**：
  - user config：`mode=fix` + `ignore=["packages/opencode-oxc-lint/e2e-tmp/user-only/**"]`
  - project config（`<cwd>/.jacob-z/jacob-z-harness-opencode.json`）：`mode=notify` + `ignore=["packages/opencode-oxc-lint/e2e-tmp/proj-only/**"]`
- **动作**：
  1. `write e2e-tmp/proj-only/t8a.ts`（命中 project ignore）→ 跳过
  2. `write e2e-tmp/user-only/t8b.ts`（命中 user ignore）→ 跳过（并集）
  3. `write e2e-tmp/t8c.ts`（ignore 都不命中）→ 注入，且用 **notify** 前缀（project mode 覆盖 user fix）
- **期望**：t8a/t8b skip；t8c 用 `[oxc-lint: informational...]`
- **实际**：✅ **通过**。
  - t8a：日志 `skip ignored by glob pattern`（project ignore 命中）
  - t8b：日志 `skip ignored by glob pattern`（user ignore 命中 → **并集生效**）
  - t8c：output 含 `[oxc-lint: informational, no fix needed]`（project `mode=notify` 覆盖 user `mode=fix` ✓）+ 日志 `check exitCode:1`
  - 合并语义全部验证：标量 project 覆盖 user、ignore 取并集。

## 七、执行顺序与配置还原

1. 每个用例开始前，写入对应 user/project harness config（JSON）。
2. 执行 write/edit，记录 tool output 与日志。
3. 回填本文件「实际」栏。
4. 全部完成后：删除 `e2e-tmp/`、删除 project `.jacob-z/`、把 user harness config 还原为 `{ "oxc-lint": { "configPath": "~/.config/oxc/oxlintrc.json" } }`。

## 八、运行时确认

`probe-notify.ts` 探测：user config 设 `mode=notify` 后，`write` 返回的 output 出现 `[oxc-lint: informational, no fix needed]` 前缀——这是 0.5.0 新代码独有的 notify 分支。证明当前 opencode 进程**已加载 17:24 build 的 dist**（含 mode/ignore/指纹基础逻辑），T1–T4、T8 得以在本会话直接验证通过。

T5 暴露的指纹 bug 修复版为 **17:43 build**（`hashDiagnostics` 剥离易变行）。当前进程仍持 17:24 版，故 T5/T6/T7 须重启加载 17:43 版后复测。

## 九、执行进度

| 步骤 | 状态 | 备注 |
|---|---|---|
| 环境调研 | ✅ | 插件走 dist；oxlint 1.68 / oxfmt 0.53 可用 |
| 错误策略验证 | ✅ | `debugger;` 经 `oxlint --fix` 不删、check 报 no-debugger |
| T1 fix | ✅ | `[oxc-lint] ... no-debugger` |
| T2 notify | ✅ | `[oxc-lint: informational, no fix needed]` |
| T3 silent | ✅ | output 干净 + 日志 `check exitCode:1` |
| T4 ignore | ✅ | `skip ignored by glob pattern`，无 pipeline |
| T8 两级配置 | ✅ | ignore 并集 + project mode 覆盖 user |
| T5 指纹同错误停注 | ✅ | 重启加载 17:43 版后通过；日志 `skip: max hints (2) reached, same diagnostics` |
| T6 指纹变化重置 | ✅ | 同错误达上限 skip → 改双 debugger 指纹变 → 重置注入 |
| T7 clean 清指纹 | ❌→已修复 | 暴露第二个 bug（clean 文件统计行误判）；18:06 修复版待复测 |
| T7 bug 修复 | ✅ | `oxlint.ts` `hasRealDiagnostics` 判 clean + `VOLATILE_TAIL_RE` 共享；防回归单测；lint 0、vitest 38/38 |
| `bun run build` (18:06) | ✅ | 两处修复（指纹 + clean 判定）已进 dist |
| 清理还原（本轮） | ✅ | 删 `e2e-tmp/`、user config 还原为仅 configPath |
| T7 clean 清指纹 | ✅ | 重启加载 18:06 版后通过：动作2 clean 不再注入 `Found 0 errors`、日志 `fix/clean`、记录删除；动作3 重新注入 |
| **全部用例** | ✅ | T1–T8 真实环境端到端全绿 |

## 十、重启后接续清单

重启 opencode 进入新会话后（dist 已是 18:06 修复版，无需再 build）：

1. 读本文件第九章确认进度（仅剩 T7 复测）。
2. 重建 `e2e-tmp/` 目录（已加 `.gitignore`），user config 设 `mode=fix, maxHints=1`。
3. 执行 T7 三步动作，验证：动作 2（写 clean `export const ok = 1;`）output **干净**（不再注入 `Found 0 errors`）、日志 `action:"fix"`；动作 3（写回 `debugger;`）重新注入。
4. 通过后清理：删 `e2e-tmp/`、user config 还原为仅 configPath。
5. T7 复测通过 = 全部 8 用例端到端验证完成，达发版前置条件。

## 十一、Bug #1：指纹含易变统计行致去重失效

**现象**：T5 同文件三次 `write` 相同 `debugger;\n`，第 3 次（maxHints=2）仍注入。

**根因**：真实 oxlint 输出尾行 `Finished in Xms` 毫秒数每次不同（3/2/4ms），原 `hashDiagnostics` 对全文 hash → 指纹每次都变 → 防闭环去重永不触发。

**为何单测没发现**：mock runner 返回固定字符串，不含易变统计行。

**修复**（`src/index.ts` `hashDiagnostics`）：剥离 `Found \d+ warning...` / `Finished in ...` 行后再 hash。加防回归单测。

**E2E 复测**：✅ T5 通过（重启加载 17:43 版后，日志 `skip: max hints (2) reached, same diagnostics`）。

## 十二、Bug #2：clean 文件因统计行被误判有诊断

**现象**：T7 动作 2 写入 clean 内容 `export const ok = 1;`，output 却被注入：
```
[oxc-lint] .../t7.ts:
Found 0 warnings and 0 errors.
Finished in 3ms ...
```

**根因**：oxlint 即使无诊断也输出 `Found 0 warnings and 0 errors` 统计行。`runLintForFile` 的 clean 判定是 `fixOutput.length === 0`，统计行非空 → 判定失效 → `result.message` 含纯统计行 → `handleToolAfter` 的 `if (!result.message)` 永不成立。后果：
1. clean 文件被注入 `Found 0 errors` 噪音，误导 LLM；
2. `stateMap.delete` 永不触发（clean 永不识别）→ 设计文档 4.3「诊断消失→清除记录」功能失效。

**为何单测没发现**：单测的 clean 用例 mock 返回空字符串 `stdout: ''`，而真实 oxlint clean 时输出非空统计行。

**修复**（`src/oxlint.ts`）：
- 新增 `hasRealDiagnostics(output)`：剥离 `VOLATILE_TAIL_RE` 行后判断是否还有实质内容。
- `runLintForFile` 改用 `hasRealDiagnostics` 判 clean：fix 阶段 exit 0 且无真实诊断 → 直接返回无 message；check 阶段两 pass 都无真实诊断 → 返回无 message。
- `VOLATILE_TAIL_RE` 提为 `oxlint.ts` 导出，`index.ts` 的 `hashDiagnostics` 复用（消除 Bug #1 修复时的重复定义）。

**防回归**（`src/oxlint.test.ts`）：新增 `treats volatile summary-only output as clean`——runner 返回 `Found 0 warnings and 0 errors.\nFinished in 3ms...` 时 `result.message` 为 undefined。另补 `baseOptions` 缺失的 `maxHints`/`mode`/`ignore` 字段（类型漂移）。

**E2E 复测**：✅ T7 通过（重启加载 18:06 版后）。动作 2 clean 文件 output 干净 + 日志 `fix/clean`；动作 3 重新注入。clean 判定 + stateMap.delete 完整生效。

## 十三、E2E 价值小结

两轮 E2E 发现两个**单测盲区**的真实 bug，且都属同一根源——oxlint 输出含运行时易变的统计行（`Found N ...` / `Finished in Xms`），而单测 mock 用固定/空字符串构造输出，从未触及。修复后单测增补对应防回归用例。结论：**pipeline/诊断类逻辑必须有真实 CLI 输出的 E2E 覆盖，单测的 mock 输出无法替代。**

## 十四、发版结论

**测试完成，达发版前置条件。**

| 项 | 状态 |
|---|---|
| T1–T8 真实环境端到端 | ✅ 全绿 |
| Bug #1（指纹易变）修复 + 防回归单测 | ✅ E2E 复测通过（T5） |
| Bug #2（clean 误判）修复 + 防回归单测 | ✅ E2E 复测通过（T7） |
| `bun run lint:fix` | ✅ 0 error |
| `bunx vitest run`（opencode-oxc-lint） | ✅ 38/38 |
| 产物清理 / 配置还原 | ✅ e2e-tmp 删、user config 还原 |

发版尚需的人工动作（按 AGENTS.md 发布流程，待用户决定）：

1. `packages/opencode-oxc-lint/package.json` version `0.3.0` → `0.5.0`
2. `git add -A && git commit -m "chore: release opencode-oxc-lint@0.5.0"`
3. `export https_proxy=http://127.0.0.1:7890 && cd packages/opencode-oxc-lint && npm publish --access public`
