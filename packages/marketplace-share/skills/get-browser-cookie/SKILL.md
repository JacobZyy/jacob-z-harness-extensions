---
name: get-browser-cookie
description: 当需要请求需要登录认证的内部网站接口时，从浏览器（Chrome > Edge > Arc > Brave）自动获取对应域名的 cookies，特别是 sso cookie。
---

# Browser Cookie Skill

## 用途

自动从浏览器获取已登录网站的 cookies，按优先级 **Chrome > Edge > Arc > Brave** 尝试，一旦获取到就返回。

**核心场景**：
- 用户已登录某个网站（通过 Chrome、Edge、Arc 或 Brave 浏览器）
- 需要在 OMP 中请求该网站的 API 接口
- 接口需要携带登录态 cookie（如 sso）
- **本 Skill 自动获取浏览器中保存的 cookie，无需手动复制粘贴**

## 使用方式

```bash
bun run packages/marketplace-share/src/get-browser-cookie/cli.ts --domain ".zhuanspirit.com"
bun run packages/marketplace-share/src/get-browser-cookie/cli.ts -d ".58corp.com" -n "session"
```

### 参数说明

| 参数 | 短参 | 默认值 | 说明 |
|------|------|--------|------|
| `--domain` | `-d` | `.zhuanspirit.com` | 域名 |
| `--cookie-name` | `-n` | 空 | cookie 名称前缀过滤 |

## 支持的浏览器

按优先级尝试，第一个成功即返回：

1. **Chrome** — `~/Library/Application Support/Google/Chrome/Default/Cookies`
2. **Edge** — `~/Library/Application Support/Microsoft Edge/Default/Cookies`
3. **Arc** — `~/Library/Application Support/Arc/User Data/Default/Cookies`
4. **Brave** — `~/Library/Application Support/BraveSoftware/Brave-Browser/Default/Cookies`

## 输出格式

```json
{
  "cookies": [
    {"name": "SSO_SESSION_ID", "value": "xxx", "domain": ".zhuanspirit.com", "path": "/"}
  ],
  "count": 1,
  "browser": "Chrome"
}
```

## 注意事项

- 仅支持 macOS
- 首次运行可能需要授权访问 Keychain（系统弹窗）
- 浏览器 Cookie DB 文件存在不代表浏览器正在运行
