---
title: aicodegather 日志与上报审计
tags: [aicodegather, debugging, logging, audit, extension]
summary: aicodegather 扩展日志排查与 n_lab_store 仓库上报记录审查，包含日志来源定位和上报内容验证。
created: 2026-06-02
provenance:
  source: omp_conversation
  project: [[projects/jacob-omp-collections/jacob-omp-collections]]
  sessions:
    - 019e843c-7935-7000-b80b-c0a0db771b06
    - 019e85f6-f9c5-7000-84e3-b2d6cd4a5b74
  mix: extracted(50%) + inferred(50%)
base_confidence: 0.60
lifecycle: draft
lifecycle_changed: 2026-06-02
---

# aicodegather 日志与上报审计

## 扩展日志来源

### 启动时的红色日志

OMP 启动时会显示 aicodegather 的红色日志，如：

```
[aicodegather] extension factory called, registering handlers...
```

这些日志来自：
- aicodegather 扩展的 `ExtensionAPI` 入口函数
- 在 `session_start` 事件中注册 handlers 时输出
- 日志级别为 `warn/error`，因此显示为红色

### 日志输出位置

- OMP 主进程日志中会包含扩展的输出
- 可以通过查看 OMP 的 verbose 日志获取更多细节
- 扩展自身的日志通过 `console.warn`/`console.error` 输出到 OMP 主进程

## n_lab_store 上报记录审查

### 审查目标

检查 aicodegather 对 `n_lab_store` 仓库的上报记录，验证：
1. 上报了哪些内容
2. 是否与 git commit 记录对应
3. 数据完整性

### 审查方法

1. 查找 aicodegather 的上报日志
2. 对比 `OrderPageRequest.java` 页面中的内容
3. 与 commit `cb6257f430f8b28e403fba02143914b5ffa89132` 进行交叉验证

### 关键发现

- aicodegather 上报记录需要与具体的 git commit 关联
- 上报内容应包含文件路径、编辑操作类型、时间戳
- 需要进一步建立上报记录与代码变更的映射关系 ^[inferred]

## 调试建议

1. 使用 `--verbose` 模式启动 OMP 查看完整日志
2. 检查 `~/.omp/logs/` 目录下的日志文件
3. aicodegather 的上报数据可通过 MCP 工具查询

## 相关页面

- [[projects/jacob-omp-collections/entities/aicodegather]]
- [[projects/jacob-omp-collections/skills/aicodegather-troubleshooting]]
