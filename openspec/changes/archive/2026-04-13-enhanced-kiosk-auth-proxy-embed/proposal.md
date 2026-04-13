## Why

当前 Grafana 原生 `kiosk` 模式只能提供粗粒度的全局界面隐藏能力，无法满足监控平台以 iframe 嵌入 dashboard / panel 时对标题、时间控件、刷新控件、panel 右上角操作菜单与布局留白的细粒度控制需求。随着嵌入式展示场景增多，继续依赖零散定制会增加升级成本，因此需要一套集中封装、可扩展、兼容原生 kiosk 的增强型展示控制方案，并配套 Auth Proxy 无感认证能力。

## What Changes

- 新增基于 URL 参数的增强型 Kiosk 展示控制协议，支持 `hide_all`、`hide_time`、`hide_refresh`、`hide_panel_menu`、`no_padding` 等自定义参数。
- 新增统一的 `useCustomKiosk` Hook，集中完成参数解析、优先级归一化与消费层状态输出，避免页面和组件重复解析查询参数。
- 在 Dashboard 与单 Panel 嵌入场景中分别接入增强型展示控制，区分全局 chrome、dashboard 头部控件、panel 右上角操作菜单和页面外围留白的职责边界。
- 保持与 Grafana 原生 `kiosk` / `kiosk=tv` 语义兼容，并明确 `kiosk=true` 不单独隐藏 panel 右上角操作菜单。
- 引入面向 iframe 嵌入场景的 Auth Proxy 认证方案说明与联调约束，确保用户在受信代理下访问嵌入页面时无需再次登录。
- 明确影响页面 / 路由，包括 dashboard 页面、solo panel 页面以及嵌入相关路由的展示行为。
- 不引入新的前端大型依赖，不修改现有接口契约；回滚方式为移除自定义参数解析和相关消费逻辑，恢复 Grafana 原生 kiosk 行为。

## Capabilities

### New Capabilities
- `enhanced-kiosk-display`: 定义增强型 Kiosk URL 参数、优先级规则、Hook 输出结构，以及 Dashboard / Panel 场景下的展示行为。
- `auth-proxy-embedded-access`: 定义 iframe 嵌入场景下基于 Auth Proxy 的无感认证约束、可信代理要求与用户体验要求。

### Modified Capabilities

无。

## Impact

- 受影响前端区域：`public/app/core/components/AppChrome/`、`public/app/features/dashboard-scene/`、`public/app/features/dashboard/`。
- 受影响页面 / 路由：dashboard 页面、`/d-solo/:uid/:slug?` 单 panel 路由，以及现有嵌入相关路由。
- 受影响配置 / 系统：Grafana Auth Proxy 配置、受信代理 Header 透传链路、iframe 嵌入部署配置。
- 接口契约：不新增前后端 API，不改变现有查询参数如 `from`、`to`、`refresh` 的业务语义。
- 依赖与构建：不新增外部依赖，不修改构建配置。
- 灰度 / 回滚：可通过不传自定义参数或移除增强型解析逻辑恢复原生展示行为；Auth Proxy 可通过关闭代理配置回退到现有登录流程。