# enhanced-kiosk-display Specification

## Purpose
TBD - created by archiving change enhanced-kiosk-auth-proxy-embed. Update Purpose after archive.
## Requirements
### Requirement: Enhanced kiosk parameters SHALL control dashboard and panel display behavior
系统 MUST 支持通过 `kiosk`、`hide_all`、`hide_time`、`hide_refresh`、`hide_panel_menu`、`no_padding` 参数控制 dashboard 与 panel 的展示行为，并对这些参数进行统一解析和归一化。

#### Scenario: Normal dashboard route uses raw parameters as display inputs
- **WHEN** 用户访问 dashboard 页面并携带上述任意自定义参数
- **THEN** 系统 MUST 统一解析这些参数并将其转换为可复用的展示状态输出

#### Scenario: Invalid custom parameter values fall back to default behavior
- **WHEN** 用户传入无法识别的增强型 kiosk 参数值
- **THEN** 系统 MUST 忽略非法值并保持对应区域的默认展示行为

### Requirement: hide_all SHALL override other custom display controls
当 `hide_all=true` 时，系统 MUST 将其视为最高优先级的增强型隐藏模式，并覆盖原生 kiosk 与其他单项隐藏参数的最终显示效果。

#### Scenario: hide_all hides all confirmed display areas
- **WHEN** 页面携带 `hide_all=true`
- **THEN** 系统 MUST 隐藏全局 chrome、时间选择器、刷新控件、panel 右上角操作菜单，并移除外围留白

#### Scenario: hide_all also hides variable bar and links
- **WHEN** 页面携带 `hide_all=true`
- **THEN** 系统 MUST 同时隐藏变量区（Variables bar）和 Links 区，避免嵌入场景下视觉残留

#### Scenario: hide_all takes precedence over partial parameters
- **WHEN** 页面同时携带 `hide_all=true` 与 `hide_time=true`、`hide_refresh=true` 或 `hide_panel_menu=true`
- **THEN** 系统 MUST 以 `hide_all=true` 的最终展示效果为准

#### Scenario: hide_all drives kioskMode.Full in AppChrome
- **WHEN** 页面携带 `hide_all=true` 且未携带 `kiosk` 参数
- **THEN** 系统 MUST 隐藏全局 chrome（等效于 kiosk=true 效果）；`AppChrome` 通过 `chrome.update({ kioskMode: KioskMode.Full })` 实现此行为，不引入独立状态字段

### Requirement: kiosk SHALL remain compatible with native Grafana behavior
`kiosk=true` MUST 保持 Grafana 原生 kiosk 行为兼容，仅控制原生全局 chrome 展示，不单独控制 panel 右上角操作菜单。

#### Scenario: kiosk hides global chrome only
- **WHEN** 页面仅携带 `kiosk=true`
- **THEN** 系统 MUST 按原生 kiosk 语义隐藏全局 chrome

#### Scenario: kiosk does not hide panel menu by itself
- **WHEN** 页面仅携带 `kiosk=true` 且未携带 `hide_all` 或 `hide_panel_menu`
- **THEN** 系统 MUST 保持 panel 右上角操作菜单可见

#### Scenario: kiosk empty string value is treated as enabled
- **WHEN** 页面携带 `?kiosk=`（即 kiosk 参数值为空字符串）
- **THEN** 系统 MUST 视为 kiosk 启用（等效于 `kiosk=true`），对齐现有 `DashboardScenePage` 中的处理逻辑

#### Scenario: ESC key clears all custom kiosk parameters
- **WHEN** 用户在携带 `kiosk=true&hide_all=true` 的页面按下 ESC 键退出 kiosk 模式
- **THEN** 系统 MUST 同时清除 `kiosk`、`hide_all`、`hide_time`、`hide_refresh`、`hide_panel_menu`、`no_padding` 等自定义参数，确保 chrome 恢复显示

### Requirement: Individual parameters SHALL affect only their scoped UI areas
`hide_time`、`hide_refresh`、`hide_panel_menu` 和 `no_padding` MUST 仅作用于各自负责的 UI 区域，不产生未声明的连带隐藏效果。

#### Scenario: hide_time affects time controls only
- **WHEN** 页面携带 `hide_time=true`
- **THEN** 系统 MUST 隐藏时间范围选择器且不因此隐藏 panel 右上角操作菜单

#### Scenario: hide_refresh affects refresh controls only
- **WHEN** 页面携带 `hide_refresh=true`
- **THEN** 系统 MUST 隐藏刷新控件且不改变时间范围选择器的默认展示状态

#### Scenario: hide_panel_menu affects panel menu only
- **WHEN** 页面携带 `hide_panel_menu=true`
- **THEN** 系统 MUST 隐藏 panel 右上角操作菜单且不影响顶部导航与左侧主菜单

#### Scenario: no_padding affects layout only
- **WHEN** 页面携带 `no_padding=true`
- **THEN** 系统 MUST 移除外围留白且不将其解释为任何组件显隐开关

### Requirement: Solo panel routes SHALL maximize visible panel area
在 `/d-solo` 等单 panel 路由中，系统 MUST 优先保证 panel 内容可视区域最大化，并支持与增强型 kiosk 参数组合使用。

#### Scenario: Solo panel route maximizes layout
- **WHEN** 用户访问单 panel 路由
- **THEN** 系统 MUST 采用适合嵌入展示的紧凑布局并优先最大化 panel 内容区域

#### Scenario: Solo panel route shows panel menu by default
- **WHEN** 用户访问单 panel 路由且未携带 `hide_panel_menu` 或 `hide_all`
- **THEN** 系统 MUST 保持 panel 右上角操作菜单可见（scene-based SoloPanelPage 与旧版硬编码不同，默认不强制隐藏菜单）

#### Scenario: Solo panel route supports panel menu hiding
- **WHEN** 用户访问单 panel 路由并携带 `hide_panel_menu=true`
- **THEN** 系统 MUST 隐藏当前 panel 的右上角操作菜单

#### Scenario: viewPanel fullscreen with hide_panel_menu
- **WHEN** 用户在普通 dashboard 路由（`/d/...`）携带 `viewPanel=X&hide_panel_menu=true`
- **THEN** 系统 MUST 隐藏全屏面板的右上角操作菜单

### Requirement: Custom kiosk state SHALL be centralized in a reusable hook
系统 MUST 通过统一的 `useCustomKiosk` Hook 暴露增强型 kiosk 状态，避免各页面和组件重复解析查询参数。

#### Scenario: Hook exposes raw context and resolved layers
- **WHEN** 页面或组件消费增强型 kiosk 状态
- **THEN** `useCustomKiosk` MUST 提供 `raw`、`context` 和 `resolved` 三层结构

#### Scenario: Hook is reactive to URL changes
- **WHEN** URL 发生变化（包括 history 前进/后退或 kiosk 模式切换）
- **THEN** `useCustomKiosk` MUST 自动重新计算输出状态，通过 `locationService.getLocationObservable()` 订阅实现，而非直接读取 `window.location.search`

#### Scenario: Consumers use resolved state instead of re-deriving priority
- **WHEN** 页面容器、AppChrome、dashboard 控件或 panel 渲染层接入增强型 kiosk 状态
- **THEN** 它们 MUST 直接消费 `resolved` 结果，而不是重复判断 `hide_all` 的覆盖规则

