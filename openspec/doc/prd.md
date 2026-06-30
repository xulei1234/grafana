# Grafana 增强型 Kiosk 视图与 Auth Proxy 嵌入方案

| 项目项 | 内容 |
| --- | --- |
| 版本 | V1.0 |
| 日期 | 2026-04-08 |
| 负责人 | 待定 |

## 1. 项目背景

当前 Grafana 原生 Kiosk 模式仅支持有限的界面隐藏能力，无法满足监控平台通过 iframe 嵌入 Grafana dashboard / panel 时的细粒度展示需求。

在实际业务中，存在以下典型诉求：

- 监控平台嵌入 Grafana 时，希望隐藏 Grafana 原生顶部导航、时间选择器、刷新、标题以及 panel 右上角操作菜单等组件。
- 不同场景需要不同的隐藏策略，例如：
  - 大屏展示：尽量只保留图表内容。
  - 汇报展示：保留标题，隐藏交互控件。
  - 面板嵌入：只保留 panel 内容。
- 用户访问嵌入页面时，不希望看到 Grafana 登录页面或跳转流程。
- 希望通过统一的 URL 参数协议来控制 Grafana 页面展示状态，减少定制维护成本。

因此，需要在 Grafana v13.0.0-local 基础上扩展增强型 Kiosk 功能，并使用 Auth Proxy 实现嵌入场景下的无感认证。

## 2. 项目目标

### 2.1 产品目标

提供一套适用于监控平台嵌入场景的 Grafana 展示模式，使 Grafana 可作为“图表渲染引擎”被外部系统使用，而不是暴露其原生控制台界面。

### 2.2 具体目标

- 支持通过 URL 参数细粒度控制 Dashboard / Panel 页面元素显隐。
- 支持 dashboard 和 panel 两类嵌入场景。
- 支持通过 iframe 无感接入 Grafana 页面。
- 使用 Auth Proxy 方案实现用户身份透传。
- 不引入 OAuth2 / OIDC / SSO 登录链路。
- 尽量降低后续 Grafana 升级时的维护成本。

## 3. 用户角色

| 角色 | 描述 |
| --- | --- |
| 平台普通用户 | 在监控平台中查看嵌入的 Grafana dashboard / panel。 |
| 运维 / 管理员 | 配置 Grafana 嵌入方式、权限和展示参数。 |
| 开发人员 | 负责 Grafana 前端改造、Auth Proxy 接入和发布维护。 |

## 4. 使用场景

### 场景 1：单个 dashboard 嵌入

用户登录监控平台后，在某监控页面中通过 iframe 查看 Grafana dashboard。要求页面不出现 Grafana 原生顶部导航，视觉上像平台原生页面。

```text
/d/adhcwcp/pinge78ab6-e68081?orgId=1&from=now-30m&to=now&timezone=browser&hideMenu=True&refresh=5s&hide_all=true
```

### 场景 2：单个 Panel 嵌入

平台页面以组件方式嵌入某个 panel，要求 panel 尽量贴边展示，避免多余留白。

```text
/d/adhcwcp/pinge78ab6-e68081?orgId=1&from=now-30m&to=now&timezone=browser&viewPanel=panel-1&hideMenu=True&refresh=5s&hide_all=true
```

## 5. 需求范围

### 5.1 本期范围

- Grafana Dashboard 页面增强型 Kiosk 能力。
- Grafana Panel 页面增强型 Kiosk 能力。
- URL 参数控制协议。
- Auth Proxy 嵌入认证方案。
- iframe 嵌入兼容支持。
- 样式与布局压缩优化。

### 5.2 非本期范围

- OAuth2 / OIDC / OA 单点登录接入。
- Grafana 原生权限模型重构。
- Dashboard 编辑功能定制。
- 多租户模型重构。
- 图表内容本身的展示逻辑调整。

## 6. 核心问题

当前原生 Grafana 在嵌入场景下主要存在以下问题：

- Kiosk 能力粗糙，只能整体隐藏，不能按组件控制。
- 嵌入 iframe 时容易暴露 Grafana 原生导航结构。
- 用户可能遇到 Grafana 登录页面，影响使用体验。
- 页面隐藏后容易残留顶部空白或边距，影响展示效果。
- 不同场景需要不同展示方案，但当前缺乏统一控制协议。

## 7. 产品方案概述

本方案由两部分组成。

### 7.1 前端展示控制

对 Grafana 前端进行定制开发，新增增强型 Kiosk 模式。通过 URL 参数解析，控制 Dashboard / Panel 页面的组件显隐和布局调整。

### 7.2 嵌入认证

采用 Auth Proxy 方式，由监控平台或网关在请求 Grafana 时透传用户身份 Header，Grafana 根据信任的 Header 自动识别用户，避免 iframe 内出现单独登录流程。

## 8. 功能需求

### 8.1 增强型 Kiosk 参数控制

需要支持以下 URL 参数：

| 参数 | 说明 |
| --- | --- |
| `kiosk` | 兼容 Grafana 原生 kiosk 模式。 |
| `hide_all` | 隐藏所有相关组件。 |
| `hide_time` | 隐藏时间范围选择器。 |
| `hide_refresh` | 隐藏刷新按钮及刷新周期设置。 |
| `hide_panel_menu` | 隐藏 panel 右上角操作菜单，如查看、编辑、分享等入口。 |
| `no_padding` | 去掉顶部 / 外围留白。 |

注意：

1. 单个 panel 场景在 dashboard 场景基础上，进一步压缩边距，优先保证 panel 内容最大化展示。
2. 默认隐藏右下角技术支持以及 Grafana logo。
3. `hide_panel_menu` 仅指 panel 右上角可选菜单，不包括左侧主菜单和顶部导航。
4. `hide_all` 优先级最高，设置后最终显示效果应覆盖 `kiosk` 与其他单项隐藏参数。
5. `kiosk=true` 仅用于兼容 Grafana 原生 kiosk 行为，不单独控制 panel 右上角操作菜单。
6. 以上 URL 参数仅作为前端展示控制，不影响 `from`、`to`、`refresh` 等已有查询参数的功能。例如：

```text
/d/adhcwcp/pinge78ab6-e68081?orgId=1&from=now-30m&to=now&timezone=browser&viewPanel=panel-1&hideMenu=True&kiosk=true&refresh=5s
```

### 8.2 URL 参数优先级

优先级从高到低：

1. `hide_all=true`
2. `kiosk=true`
3. 单个组件隐藏参数：`hide_time`、`hide_refresh`、`hide_panel_menu`
4. `no_padding=true`
5. 路由上下文增强：`/d-solo` 等单 panel 路由自动启用 panel 最大化语义

归一化规则：

- `hide_all=true` 时，最终效果等价于同时隐藏全局 chrome、时间选择器、刷新控件、panel 右上角操作菜单，并移除外围留白。
- 未设置 `hide_all` 时，`kiosk=true` 仅控制原生 kiosk 对应的全局 chrome 展示，不隐式隐藏 panel 右上角操作菜单。
- `hide_time`、`hide_refresh`、`hide_panel_menu` 仅作用于各自负责的 UI 区域，彼此不连带。
- `no_padding=true` 仅负责布局压缩，不承担组件显隐语义。

### 8.3 Dashboard 页面需求

Dashboard 页面应支持：

- 按 URL 参数控制顶部导航是否展示。
- 按 URL 参数控制时间范围组件是否展示。
- 按 URL 参数控制刷新组件是否展示。
- 按 URL 参数控制 dashboard 内各 panel 右上角操作菜单是否展示。

### 8.4 Panel 页面需求

Panel 页面应支持：

- 支持 dashboard 支持的 URL 参数控制模式。
- panel 单独展示时尽量压缩边距。
- 支持按 URL 参数控制当前 panel 的右上角操作菜单是否展示。

### 8.5 Auth Proxy 认证需求

认证方式统一采用 Auth Proxy：

- 用户先登录监控平台。
- 平台通过代理访问 Grafana 时注入用户 Header。
- Grafana 自动识别 Header 中的用户身份。
- iframe 内不出现 Grafana 登录页面。
- 用户体验上应为无感登录。
- 支持根据配置自动注册 Grafana 用户。

## 9. 功能规则说明

### 9.1 显隐规则

- `hide_all=true` 时，页面进入增强型全隐藏状态，统一覆盖原生 kiosk 与自定义显隐项的最终显示效果。
- 未设置 `hide_all` 时，时间、刷新、panel 右上角操作菜单等子组件按各自参数分别控制。
- `kiosk=true` 时，仅兼容 Grafana 原生 kiosk 行为，不单独隐藏 panel 右上角操作菜单。
- `hide_panel_menu=true` 时，仅隐藏 panel 右上角操作菜单，不影响左侧主菜单和顶部导航。
- `no_padding=true` 时，页面需移除因隐藏头部产生的多余空白。
- 在 `/d-solo` 等单 panel 场景下，优先确保 panel 内容区域最大化。

### 9.2 兼容规则

- 未传入任何自定义参数时，Grafana 行为应与原生保持一致。
- 已有原生 `kiosk` 逻辑需兼容：`?kiosk`（无值）、`?kiosk=1`、`?kiosk=true`（后两者经 parseKeyValue 解析为 boolean `true` 或字符串 `'1'`）激活 kiosk；`?kiosk=`（显式空值，字符串 `''`）**不**激活，与 `?kiosk` 无值场景明确区分。该规则在 `AppChromeService.setKioskModeFromUrl`、`getKioskMode`、`useCustomKiosk.isKioskEnabled` 三处一致生效。
- `kiosk=tv` 为遗留值，当前版本（Grafana v13，`KioskMode` 枚举仅含 `Full`）不支持，变更前同样不被识别为 kiosk 启用值，仅测试用例中有引用，不在本次兼容范围内。
- 新增参数不应影响普通 Grafana 控制台使用。

### 9.3 安全规则

- 前端隐藏仅影响显示效果，不作为权限控制手段。
- 即使用户通过浏览器工具恢复按钮或修改 DOM，后端仍需基于用户权限决定是否允许操作。
- Grafana 仅信任来自代理白名单的 Header。

## 10. 页面 / 交互说明

### 10.1 交互原则

本需求不新增用户可见配置页面，所有能力通过 URL 参数和后端配置实现。

### 10.2 页面表现要求

**Dashboard 场景**

- 隐藏头部后，图表区域自动上移。
- 页面视觉紧凑。
- 不出现明显 Grafana 原生控制台元素。

**Panel 场景**

- panel 内容尽量贴边。
- 不出现多余边距和外层导航。
- 在单 panel 路由下优先保证可视区域最大化。

**iframe 场景**

- 页面直接显示可用内容。
- 不出现登录页。
- 不出现中间跳转体验。

## 11. 典型示例

### 示例 1：嵌入 dashboard，仅保留内容区

```text
/d/xxxx/monitor?kiosk&hide_all=true&no_padding=true
```

### 示例 2：保留原生 kiosk，同时隐藏时间和刷新

```text
/d/xxxx/monitor?kiosk&hide_time=true&hide_refresh=true
```

### 示例 3：隐藏 panel 右上角操作菜单

```text
/d/xxxx/monitor?kiosk&hide_panel_menu=true
```

### 示例 4：单 panel 嵌入

```text
/d-solo/xxxx/monitor?panelId=3&hide_panel_menu=true&no_padding=true
```

## 12. 技术实现要求

### 12.1 前端要求

- 所有 URL 参数解析逻辑统一封装。
- 所有自定义 URL 参数解析逻辑必须集中封装在 `useCustomKiosk` Hook 中。
- `useCustomKiosk` 负责统一解析所有 URL 参数，并输出标准状态供多个组件复用。
- 避免各组件重复解析 `window.location.search`。
- 优先通过 React 条件渲染移除 DOM。
- 减少 CSS hack 依赖。
- 布局调整集中处理。

### 12.2 `useCustomKiosk` 设计草案

`useCustomKiosk` 建议统一返回三层结构：

- `raw`：保留原始 URL 输入，如 `kiosk`、`hideAll`、`hideTime`、`hideRefresh`、`hidePanelMenu`、`noPadding`。
- `context`：描述当前页面上下文，如 `isDashboardPage`、`isSoloPanelPage`、`isEmbeddedRoute`。
- `resolved`：输出最终消费状态，如 `hideChrome`、`hideTime`、`hideRefresh`、`hidePanelMenu`、`removeOuterPadding`、`maximizePanelArea`、`hideKioskFooter`。

约束要求：

- `resolved` 必须在 Hook 内完成优先级归一化，消费组件不应重复判断 `hide_all` 是否覆盖其他参数。
- `resolved.hidePanelMenu` 只能由 `hide_all` 或 `hide_panel_menu` 推导，不应由 `kiosk=true` 单独推导得到。
- `/d-solo` 等单 panel 路由应通过 `context` 推导 `maximizePanelArea=true`，而不是依赖额外 URL 参数。

### 12.3 消费层职责建议

- AppChrome 只消费 `resolved.hideChrome`。
- Dashboard 页面头部控件只消费 `resolved.hideTime`、`resolved.hideRefresh`。
- Panel 渲染层只消费 `resolved.hidePanelMenu`。
- Dashboard / Solo 页面容器消费 `resolved.removeOuterPadding` 与 `resolved.maximizePanelArea`。
- Branding / Footer 区域消费 `resolved.hideKioskFooter`。

### 12.4 认证要求

- 使用 Auth Proxy。
- 限制可信代理来源。
- 支持 iframe 场景。
- 不采用前端 token 拼接方案。

### 12.5 可维护性要求

- 新参数扩展时仅需修改统一逻辑入口。
- 尽量减少分散在各组件中的参数判断。
- 降低后续 Grafana 版本升级冲突风险。

## 13. 验收标准

### 13.1 功能验收

#### 用例 1

访问：

```text
...?kiosk&hide_time=true&hide_refresh=true
```

预期：

- 时间选择器与刷新组件隐藏。
- 标题及其他未指定组件正常显示。

#### 用例 2

访问：

```text
...?kiosk&hide_all=true&no_padding=true
```

预期：

- 所有头部元素隐藏。
- 页面顶部无空白。

#### 用例 3

访问：

```text
.../d-solo/:uid/:slug?panelId=3&hide_panel_menu=true&no_padding=true
```

预期：

- panel 内容区最大化。
- panel 右上角操作菜单不显示。
- iframe 内视觉紧凑。

### 13.2 认证验收

#### 用例 4

用户已登录监控平台后打开嵌入页面。

预期：

- iframe 中直接显示 Grafana 内容。
- 无 Grafana 登录页。

#### 用例 5

用户直接访问 Grafana 地址。

预期：

- 按部署策略处理，不应无条件绕过代理认证。

#### 用例 6

非白名单源伪造 Header。

预期：

- Grafana 不信任请求中的认证 Header。

## 14. 风险与注意事项

- Grafana 版本升级可能导致组件结构变化，需要适配前端改造点。
- 部分隐藏逻辑若依赖具体组件结构，需控制改造范围。
- iframe 场景需同时关注浏览器 Cookie、SameSite、Embedding 配置。
- Auth Proxy 必须严格限制可信代理白名单，否则存在身份伪造风险。
- 前端隐藏不等于权限隔离，必须依赖后端权限校验兜底。

## 15. 里程碑建议

| 里程碑 | 内容 |
| --- | --- |
| 里程碑 1 | 完成 Dashboard 增强型 Kiosk 参数解析与基础隐藏能力。 |
| 里程碑 2 | 完成 Panel 独立展示与布局压缩能力。 |
| 里程碑 3 | 完成 Auth Proxy 接入及 iframe 联调。 |
| 里程碑 4 | 完成联调测试、验收与发布。 |

## 16. 成功标准

项目上线后，满足以下标准视为成功：

- Grafana 可作为监控平台内嵌图表引擎稳定使用。
- iframe 场景下用户无感登录。
- 不同展示场景可通过 URL 参数灵活切换。
- 页面展示更简洁、专业、可控。
- 后续新参数扩展成本低。