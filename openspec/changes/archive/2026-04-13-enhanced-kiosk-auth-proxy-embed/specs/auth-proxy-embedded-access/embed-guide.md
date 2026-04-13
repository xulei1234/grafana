# Auth Proxy 嵌入访问接入指南

本文档覆盖任务 3.1、3.2、3.3、5.1、5.2，为希望将 Grafana dashboard 或 panel 嵌入 iframe 并结合 Auth Proxy 实现无感认证的接入方提供完整参考。

---

## 1. Grafana 端前置配置（3.1）

在正式联调前，需在 Grafana 的 `grafana.ini` / `conf/custom.ini` 中完成以下三组配置。

### 1.1 允许 iframe 嵌入

```ini
[security]
allow_embedding = true
cookie_samesite = none    # iframe 跨站场景必须为 none
cookie_secure = true      # SameSite=None 要求必须配合 Secure（即 HTTPS）
```

> **风险提示**：`allow_embedding = true` 会移除 `X-Frame-Options: DENY` 响应头。必须确保 Grafana 部署在受控网络内，避免点击劫持风险。

### 1.2 启用 Auth Proxy

```ini
[auth.proxy]
enabled = true
header_name = X-WEBAUTH-USER         # 代理注入的用户名 Header
header_property = username            # 以 username 或 email 与 Grafana 用户对应
auto_sign_up = true                   # 代理用户首次访问时自动创建 Grafana 账户
sync_ttl = 15                         # 身份同步 TTL（分钟）
whitelist = 10.0.0.0/8,192.168.1.100 # 只信任来自此 IP 段/IP 的请求（必须配置）
headers =                             # 可选：额外同步的 Header，如 X-WEBAUTH-EMAIL:email
headers_encoded = false
enable_login_token = false
```

> **安全边界**：`whitelist` 是唯一的服务端信任边界，只有白名单来源的 Header 才被信任。前端 UI 隐藏（包括本次增强型 Kiosk 参数）**不构成**任何认证控制。

### 1.3 禁用登录表单（可选）

如果整个 Grafana 实例仅用于代理嵌入，可关闭登录表单以减少误操作入口：

```ini
[auth]
disable_login_form = true
disable_signout_menu = true
```

---

## 2. 前端对 Auth Proxy 失败的处理方式（3.2）

**结论：本次前端改动不影响 Auth Proxy 失败时的任何处理逻辑。**

验证依据（代码层）：

- `DashboardScenePage.tsx` 中 `loadError` 由 `stateManager.useState()` 提供，若后端返回 401/403，会命中 `DashboardPageError` 组件，展示现有权限错误页——本次未修改此路径（见 `DashboardScenePage.tsx:111-112`）。
- `useCustomKiosk` hook 仅解析 URL 参数并推导 UI 可见性，不包含任何 token 注入、Session 续期或 Header 伪造逻辑。
- `AppChromeService.setKioskModeFromUrl` 的修改仅补全了 `kiosk=''` 的分支缺失，不涉及认证逻辑。

**当 Auth Proxy 失败时：**

| 失败原因 | Grafana 行为 | 前端展示 |
|---------|------------|---------|
| 代理未注入 Header | 后端视为匿名请求，按部署策略 302 重定向登录页或返回 401 | iframe 内呈现登录页或 `DashboardPageError` |
| 代理 IP 不在白名单 | Header 被忽略，后端视为匿名请求 | 同上 |
| 用户无 dashboard 查看权限 | 后端返回 403 | `DashboardPageError` 展示权限错误 |

---

## 3. iframe 嵌入联调步骤（3.3）

### 3.1 Dashboard 嵌入

```html
<iframe
  src="https://grafana.example.com/d/{uid}/{slug}?kiosk=1&hide_time=true&hide_refresh=true&from=now-1h&to=now"
  width="1280"
  height="720"
  frameborder="0">
</iframe>
```

联调检查清单：

- [ ] Grafana 服务可通过 HTTPS 访问（SameSite=None 要求）
- [ ] 浏览器控制台无 `Blocked by X-Frame-Options` 或 `Content-Security-Policy` 报错
- [ ] 代理请求中包含 `X-WEBAUTH-USER` 或配置的 `header_name`
- [ ] Grafana 日志中无 `auth proxy: unauthorized` 错误（说明白名单生效）
- [ ] Dashboard 直接呈现内容，不跳登录页
- [ ] `hide_time=true` 时页面中时间选择器不可见
- [ ] `hide_refresh=true` 时刷新选择器不可见
- [ ] `hide_panel_menu=true` 时所有 panel 的菜单（⋮）不可见
- [ ] 按 ESC 键后自定义参数被清除，UI 恢复正常

### 3.2 Solo Panel 嵌入

```html
<iframe
  src="https://grafana.example.com/d-solo/{uid}/{slug}?panelId=2&hide_panel_menu=true&hideLogo=true"
  width="640"
  height="360"
  frameborder="0">
</iframe>
```

联调检查清单：

- [ ] URL 包含 `panelId` 参数，否则展示 `EntityNotFound`
- [ ] `hide_panel_menu=true` 时 panel 菜单不可见
- [ ] `hideLogo=true` 或 `hide_all=true` 时 Grafana 水印 logo 不出现
- [ ] 面板数据正常刷新（refreshPicker 激活）

### 3.3 `hide_all` 全量隐藏

```
/d/{uid}/{slug}?hide_all=true&from=now-6h&to=now&refresh=5m
```

- 等效于 `kiosk=1` + 隐藏时间/刷新/变量/链接/panel 菜单/footer
- 时间范围（`from`/`to`）和自动刷新（`refresh`）参数**不受影响**，数据仍正常刷新

---

## 4. 增强型 Kiosk 参数速查（5.1）

| URL 参数 | 类型 | 说明 |
|---------|------|------|
| `hide_all=true` | boolean | 隐藏全部 chrome（等效 `kiosk=1`）并隐藏 panel 菜单、footer、logo |
| `hide_time=true` | boolean | 仅隐藏时间范围选择器，保留刷新选择器 |
| `hide_refresh=true` | boolean | 仅隐藏刷新选择器，保留时间选择器 |
| `hide_panel_menu=true` | boolean | 隐藏所有 panel 的菜单按钮（URL 移除时自动恢复） |
| `no_padding=true` | boolean | 移除 Dashboard 外层内边距 |

**与原生参数的优先级规则：**

- `kiosk=1` 或 `kiosk=` 触发原生 KioskMode.Full（隐藏整个顶栏/侧栏），优先级与 `hide_all` 相同
- 自定义参数只控制 UI 可见性，不影响 `from`/`to`/`refresh`/`var-*` 等数据参数
- `_dash.hideTimePicker=true`（dashboard 内部 URL 参数）仍同时设置时间+刷新隐藏（保持向后兼容）

---

## 5. 风险与回滚（5.2）

### 5.1 主要风险

| 风险 | 缓解措施 |
|-----|---------|
| Auth Proxy 白名单未配置，任意来源 Header 可伪造身份 | `whitelist` 配置是强制前置条件；未配置则拒绝上线 |
| `allow_embedding=true` + 公网暴露导致点击劫持 | 仅在受控内网启用；可配合 CSP `frame-ancestors` 限制来源域 |
| `cookie_samesite=none` 要求 HTTPS，HTTP 环境下 cookie 丢失 | 强制 HTTPS 部署；开发环境可用 `cookie_samesite=disabled` 调试 |
| ESC 键退出 kiosk 后自定义参数残留 | `exitKioskMode()` 已同步清除所有自定义参数（`CUSTOM_KIOSK_PARAM_LIST`）|
| VizPanel menu 批量设为 `undefined` 后不可恢复 | `DashboardScene._activationHandler` 用 `Map<panelId, menu>` 保存原始引用，URL 移除时恢复 |
| `hide_all` 触发 kiosk 后 footer 仍显示 | 已修复：`DashboardScenePage` 将 `resolved.hideKioskFooter` OR 进 `hideFooter` 判断 |

### 5.2 回滚步骤

**前端回滚（如新参数引发问题）：**

1. 在嵌入链接中停止传递 `hide_all`/`hide_time`/`hide_refresh`/`hide_panel_menu`/`no_padding` 参数
2. 已有 URL 无需服务器变更，参数不存在时回退为默认行为
3. 如需完全移除代码：revert 以下 commits：
   - `feat/frontOps` 分支的 7 个 kiosk 相关 commit
   - 确保 `DashboardControls.tsx`、`AppChromeService.tsx`、`DashboardScenePage.tsx` 还原

**Auth Proxy 回滚：**

```ini
[auth.proxy]
enabled = false

[security]
allow_embedding = false
cookie_samesite = lax
```

重启 Grafana 即生效，无需前端部署。

### 5.3 验收标准

- [ ] `?hide_all=true` 嵌入场景：无 chrome，数据正常刷新，ESC 后 UI 恢复
- [ ] `?hide_time=true&hide_refresh=true` 各自独立控制，互不影响
- [ ] `?hide_panel_menu=true` 移除后 panel 菜单恢复（不需刷新页面）
- [ ] Auth Proxy 失败时展示现有错误页，无前端绕过迹象
- [ ] `from`/`to`/`refresh`/`var-*` 参数与增强型参数共存时行为一致
