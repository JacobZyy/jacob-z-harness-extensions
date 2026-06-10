---
title: Xiaomi Mimo 登录流程
tags: [oh-my-pi, login, xiaomi, mimo, authentication]
summary: Oh My PI 中 Xiaomi Mimo 登录逻辑分析，包括 token 验证、API 端点和 401 错误排查。
created: 2026-06-02
provenance:
  source: omp_conversation
  project: oh-my-pi
  sessions:
    - 019e8613-d3cc-7000-be33-abf398df9c29
  mix: extracted(60%) + inferred(40%)
base_confidence: 0.60
lifecycle: draft
lifecycle_changed: 2026-06-02
---

# Xiaomi Mimo 登录流程

## 登录流程概述

当用户在 OMP 登录时选择 Xiaomi Mimo 并输入 token，系统执行以下流程：

1. 用户选择 Xiaomi Mimo 作为登录方式
2. 输入 token（格式如 `tp-ci1p8t1w4e1sbxgyc8v65tnrjbzro287igmvyf25van9mt76`）
3. 系统向 `token-plan-cn.xiaomimimo.com` 发起验证请求
4. 验证成功后获取用户凭证

## 已知问题

### 401 异常

在登录过程中可能遇到 401 异常，原因包括：

- Token 格式不正确或已过期
- API 端点配置错误
- 网络代理问题导致请求失败

### 排查步骤

1. 确认 token 格式正确（`tp-` 前缀）
2. 检查 `token-plan-cn.xiaomimimo.com` 是否可访问
3. 查看 OMP 日志中的请求详情
4. 验证代理配置是否正确

## 调试命令

可以在 CLI 中测试登录逻辑：

```bash
# 测试 token 验证
curl -X POST https://token-plan-cn.xiaomimimo.com/api/verify \
  -H "Authorization: Bearer <token>"
```

## 代码修改

在会话中提交了 PR 修复登录流程问题，主要修改：
- 修正了 token 验证的 API 端点
- 改进了错误处理和用户提示

## 相关页面

- [[projects/jacob-omp-collections/concepts/marketplace-system]] — OMP Marketplace 系统
