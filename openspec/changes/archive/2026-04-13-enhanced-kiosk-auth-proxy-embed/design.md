## Context

当前 Grafana 的原生 kiosk 能力主要通过全局 chrome 控制实现，适合隐藏顶部导航和侧边栏，但不直接覆盖 dashboard 头部控件、panel 右上角操作菜单、外围留白与单 panel 页面最大化布局。现有代码中已经存在三类可复用入口：

- `AppChrome` / `AppChromeService`：负责全局 chrome 与原生 kiosk 状态。
- `DashboardControls`：负责 dashboard scene 的时间控件、刷新控件和部分 URL 到 state 的单向初始化。
- Dashboard / Solo Panel 页面容器：负责页面级布局、footer/logo 以及 panel 独立展示。

本次改动是一个跨多个模块的前端展示增强方案，同时涉及嵌入认证约束与路由行为，因此需要在编码前统一模块边界、参数优先级和消费职责，避免把自定义逻辑散落到 AppChrome、dashboard scene 和旧版 dashboard 页面中。

关键约束：

- 不引入新的大型前端依赖。
- 不改变现有 `from`、`to`、`refresh` 等查询参数语义。
- 保持 `kiosk` / `kiosk=tv` 原生兼容能力。
- `kiosk=true` 不单独隐藏 panel 右上角操作菜单。
- iframe 认证依赖 Auth Proxy 与受信代理配置，前端隐藏不能替代权限控制。

相关干系方包括前端开发、Grafana 部署与代理配置维护人员，以及监控平台的 iframe 嵌入接入方。

## Goals / Non-Goals

**Goals:**

- 定义增强型 Kiosk URL 参数协议及其优先级规则。
- 引入统一的 `useCustomKiosk` Hook，集中输出 `raw`、`context`、`resolved` 三层状态。
- 将展示控制职责清晰拆分到全局 chrome、dashboard 控件、panel 菜单和页面容器。
- 覆盖 dashboard 页面与 solo panel 页面两类嵌入展示路径。
- 明确 Auth Proxy 嵌入访问的前置条件、失败表现与回滚方式。
- 为后续单测、组件测和联调用例提供稳定的测试切入点。

**Non-Goals:**

- 不重构 Grafana 原生权限模型。
- 不修改现有 API 或新增后端接口。
- 不引入新的用户可见配置页面。
- 不在本次变更中扩展更多 URL 参数，如标题单独控制、面包屑单独控制等未在 PRD 确认的能力。
- 不通过前端 token 或自定义登录链路替代 Auth Proxy。

## Decisions

### 1. 使用 `useCustomKiosk` 作为唯一自定义参数入口

**决策**：所有自定义 URL 参数解析逻辑统一放入 `useCustomKiosk`，由 Hook 输出三层结构：

- `raw`：原始输入值。
- `context`：页面上下文，如 `isDashboardPage`、`isSoloPanelPage`、`isEmbeddedRoute`。
- `resolved`：归一化后的最终消费状态，包含 `hideChrome`、`hideTime`、`hideRefresh`、`hidePanelMenu`、`hideVariables`、`hideLinks`、`removeOuterPadding`、`maximizePanelArea`、`hideKioskFooter`。

**原因**：

- 避免多个页面和组件重复解析 `window.location.search`。
- 将 `hide_all` 的覆盖逻辑集中在 Hook 内处理，降低消费层复杂度。
- 便于在 scene 路径和旧版 dashboard 路径间复用同一语义输出。

**响应性机制**：Hook 内部使用 `locationService.getLocationObservable()` 配合 `useObservable`（来自 `react-use`）订阅位置变化，确保 URL 变化（包括前进/后退和 kiosk 模式切换）时 Hook 自动重新计算输出。调用方式必须提供初始值：`useObservable(locationService.getLocationObservable(), locationService.getLocation())`，否则 `useObservable` 在首次渲染时返回 `undefined`，导致所有 `resolved` 标志误判为未启用。**禁止**直接读取 `window.location.search`，因为后者不响应 history 事件。

**isSoloPanelPage 检测**：通过监听 `location.pathname` 是否以 `/d-solo/` 开头来判断，无需额外路由参数。

**isViewPanelFullscreen 检测**：通过 `locationService.getSearchObject().viewPanel != null` 判断（`/d/...?viewPanel=X` 形态的全屏 panel 不走 `/d-solo/` 路径）。两者均为 `true` 时 `maximizePanelArea=true`。

**isEmbeddedRoute 已移除**：该字段无可靠的纯 URL 检测来源，iframe 环境检测（`window.self !== window.top`）存在跨域限制；`DashboardRoutes.Embedded` 在 hook 内不可直接访问。消费场景由 `isSoloPanelPage`、`isViewPanelFullscreen` 和 URL 参数组合描述。

**备选方案**：

- 直接在各消费组件内读取查询参数：实现快，但后续容易出现优先级不一致。
- 把所有逻辑堆到 `AppChromeService`：会把 dashboard 内部展示语义与全局导航层强耦合，升级风险更高。

### 2. 让 `resolved` 成为唯一消费层输入

**决策**：页面和组件只消费 `resolved`，不再自行判断 `hide_all` 是否覆盖其他参数。

**原因**：

- 消费层只关心“是否要隐藏”，不关心“为什么隐藏”。
- 可以避免 dashboard scene 和旧版 panel 路径出现不同归一化逻辑。

**归一化规则**：

- `hide_all=true` 时：`hideChrome`、`hideTime`、`hideRefresh`、`hidePanelMenu`、`hideVariables`、`hideLinks`、`removeOuterPadding`、`hideKioskFooter` 全部为 `true`。这同时覆盖变量区（Variables bar）和 Links 区，避免嵌入场景下视觉残留。
- 未设置 `hide_all` 时：`kiosk=true`（含 `kiosk=1`、`kiosk=''`）只影响 `hideChrome`。
- `hide_time=true` 只影响 `hideTime`。
- `hide_refresh=true` 只影响 `hideRefresh`。
- `hide_panel_menu=true` 只影响 `hidePanelMenu`。
- `no_padding=true` 只影响 `removeOuterPadding`。
- `isSoloPanelPage=true`（pathname 含 `/d-solo/`）时，`maximizePanelArea=true`。

**kiosk 参数边缘值**：`kiosk === '1'`、`kiosk === true`（即 `?kiosk` 无值，经 parseKeyValue 解析为 boolean）均视为 kiosk 启用。`kiosk === ''`（`?kiosk=` 显式空值）不触发 kiosk，与 `?kiosk` 无值场景区分。`?kiosk=true` URL 字符串经 parseKeyValue 解析为 boolean `true`，因此也会触发 kiosk。对齐 `DashboardScenePage.tsx`、`AppChromeService.setKioskModeFromUrl`。

### 3. 按展示层拆分消费职责

**决策**：

- `AppChrome`：在现有 `useEffect` 中额外读取 `hide_all`，当 `resolved.hideChrome=true` 时调用 `chrome.update({ kioskMode: KioskMode.Full })`，复用 kiosk 系统驱动 `chromeless` 状态。不在 `AppChromeService` 新增独立字段，避免双轨状态。
- dashboard scene 控件层：在 `DashboardControls` 新增 `hideRefreshControls` 独立状态字段，与现有 `hideTimeControls` 拆分，分别消费 `resolved.hideTime`、`resolved.hideRefresh`；同时消费 `resolved.hideVariables`、`resolved.hideLinks`。
- panel 渲染层：在 scene 路径中，由 `DashboardScene` 激活时读取 `resolved.hidePanelMenu`，批量对所有 `VizPanel` 调用 `panel.setState({ menu: undefined })` 来隐藏菜单；在旧版路径中继续通过 `hideMenu` prop 透传。`/d-solo` 路由下默认不隐藏菜单，需显式传 `hide_panel_menu=true` 才触发隐藏。
- Dashboard / Solo 页面容器消费 `resolved.removeOuterPadding`、`resolved.maximizePanelArea`、`resolved.hideKioskFooter`。

**原因**：

- 保持每层只处理自己原本负责的 UI 范围。
- 复用现有 `DashboardControls` 和 `AppChrome` 能力，而不是新增一层全局状态管理。
- `hide_all` 复用 `kioskMode.Full` 驱动 chrome 隐藏，避免在 `AppChromeService` 中引入新的并行状态字段。

**备选方案**：

- 单点在页面容器里统一做 CSS 隐藏：实现成本低，但会留下过多 DOM 和脆弱样式依赖。
- `AppChromeService` 新增 `forceChromeless` 字段：更语义纯粹，但引入新的状态轨道，与 `kioskMode` 职责重叠。

### 4. 优先复用 scene 路径已有的 URL 初始化模式

**决策**：在 dashboard scene 路径中优先复用 `DashboardControls` 现有的“URL 单向初始化到 state”的模式，将 `useCustomKiosk` 的输出作为 scene state 初始化来源；旧版 dashboard / solo panel 路径单独接入同一 Hook 的 `resolved` 结果。

**原因**：

- scene 路径已存在控件隐藏逻辑和 URL 初始化机制，重复造轮子会增加维护成本。
- 旧版路径仍在路由中保留，需要保证行为一致。

**Bridge useEffect 为有意的单向（additive-only）设计**：

`DashboardScenePage` 中的 bridge `useEffect` 将 `resolved.hideTime` / `resolved.hideRefresh` 等值写入 `DashboardControls` scene state 时，遵循**只增不减**原则——参数从 URL 中移除后，控件不会自动恢复显示。这是**有意设计**，与原生 `_dash.hideTimePicker` / `_dash.hideVariables` 在 `DashboardControls.updateFromUrl()` 中的处理方式完全一致：

- 嵌入场景的入口 URL 在用户会话内保持不变；如需切换展示模式，应导航到新 URL，届时 `routeReloadCounter` 或 `uid` 变化会触发 dashboard 重新加载，`DashboardControls` 从初始 state 重建。
- 实现双向同步需要在 `DashboardControls` 内区分"来自 URL"和"来自 dashboard model"的 flag 来源，引入显著复杂度，与现有模式不符。

**不要**将此 `useEffect` 改为双向同步，除非同时修改 `DashboardControls.updateFromUrl()` 和原生 `_dash.*` 参数的处理方式，保持三者行为一致。

### 5. Auth Proxy 只定义访问约束，不在前端伪造认证

**决策**：前端文档和实现只围绕“在受信代理与现有 Grafana 配置下如何实现无感访问”展开，不新增前端 token 注入、登录跳转拦截或非标准认证链路。

**原因**：

- Auth Proxy 已有 Grafana 原生配置入口，前端只需避免嵌入体验被额外破坏。
- 安全边界必须由受信代理、Header 白名单和后端权限控制保证。

### 6. 错误处理与用户反馈沿用现有 Grafana 模式

**决策**：

- 参数解析失败时采用“忽略非法值并回退为默认行为”，不新增报错弹窗。
- dashboard / solo panel 原有加载失败继续使用现有 Page Error / Alert 展示。
- Auth Proxy 失败不由前端兜底绕过，只展示现有登录或权限失败结果。

**原因**：

- 这类参数属于可选增强能力，非法值不应破坏基础访问路径。
- iframe 中弹出侵入式错误提示会影响嵌入体验。

### 7. 测试策略覆盖 URL、渲染和嵌入联调三层

**决策**：

- Hook 单测验证参数解析与优先级归一化。
- 组件 / 页面测试验证 dashboard controls、panel 菜单、solo 页面布局与 footer/logo 显隐。
- 联调或 E2E 验证 iframe 场景在 Auth Proxy 下的无感访问路径。

**原因**：

- 这次改动的核心风险在于多层消费点一致性，而不是单一组件逻辑。

## Risks / Trade-offs

- [Dashboard scene 与旧版 dashboard 路径行为不一致] → 通过同一个 `useCustomKiosk` 输出和共享测试矩阵约束两条路径。
- [部分隐藏逻辑依赖具体 DOM 结构，升级 Grafana 后失效] → 优先使用条件渲染和现有 state 控制，减少样式 hack。
- [把 `hide_all` 绑定成原生 `kiosk` 的别名，导致消费层职责混乱] → `hide_all` 在 Hook 内推导 `resolved`，并在 AppChrome 层以 `kioskMode.Full` 驱动 chrome 隐藏；`DashboardBrandingFooter` 等依赖 `kioskMode` 的组件将同步受影响，此为预期行为。**`hide_all=true` 会覆盖 `kiosk=tv`，强制进入 `KioskMode.Full`**——这是有意决策，`hide_all` 优先级高于 `kiosk=tv`。
- [Auth Proxy 环境配置不完整导致 iframe 仍跳登录页] → 将可信代理、Cookie / SameSite / Embedding 配置列入联调前置条件与验收项。
- [非法 URL 参数导致异常展示] → 非法值一律按未启用处理，保证默认行为可回退。
- [新增判断导致渲染分支变多] → 保持 Hook 输出扁平、消费边界清晰，并为关键路径补充单测和组件测。
- [ESC 键退出 kiosk 后 `hide_all` 残留] → `AppChromeService.exitKioskMode()` 在清除 `kiosk` 参数时，需同步清除 `hide_all`、`hide_time`、`hide_refresh`、`hide_panel_menu`、`no_padding` 等自定义参数，避免用户按 ESC 后 chrome 仍被隐藏。ESC 不清除不含 `kiosk` 的自定义参数（如仅 `?hide_time=true`），此为有意设计。
- [scene 路径 panel menu 批量置 undefined 的时机] → 在 `DashboardScene` 的激活处理器（`onActivate`）中读取 `resolved.hidePanelMenu` 并设置，URL 变化时通过 `locationService.getLocationObservable()` 触发重新设置。**必须在闭包内保存原始 `VizPanelMenu` 引用以支持双向恢复**，否则参数移除后菜单无法恢复。
- [`DashboardControls` 新增 `hideRefreshControls` 字段] → 向后兼容策略：`_dash.hideTimePicker=true` 继续同时设置 `hideTimeControls=true` 和 `hideRefreshControls=true`；新增 `_dash.hideRefreshPicker=true` 只设置 `hideRefreshControls=true`；自定义参数 `hide_time` 只设置 `hideTimeControls`，`hide_refresh` 只设置 `hideRefreshControls`。
- [**已修正**：`AppChromeService.setKioskModeFromUrl` 漏处理 `kiosk === ''`] → 已撤销该修正：`?kiosk=`（显式空值）不激活 kiosk，只有 `?kiosk`（无值，解析为 boolean true）和 `?kiosk=1` 激活。`setKioskModeFromUrl` 仅处理 `'1'` 和 `true` 两个 case。
- [**已修正**：`useObservable` 首次渲染返回 `undefined`] → 使用 `useObservable(locationService.getLocationObservable(), locationService.getLocation())` 提供初始值，避免首帧渲染空窗。
- [`viewPanel=X` 全屏模式下 `hide_panel_menu` 需独立处理] → `DashboardSceneRenderer` 中的全屏 panel 激活时机可能晚于 `DashboardScene.onActivate` 中的批量隐藏，需在全屏 panel 激活路径上额外消费 `hidePanelMenu` 状态。
- [`DashboardScenePage` footer 逻辑需注入 `resolved.hideKioskFooter`] → 当前 `DashboardScenePage:132` 的 `hideFooter` 只读取 `queryParams.hideLogo`；`hide_all=true` 触发 kiosk 后 footer 因 `!isKioskMode=false` 而出现，需将 `resolved.hideKioskFooter` 也纳入 `hideFooter` 判断。
- [`context.isEmbeddedRoute` 已从设计中移除] → 该字段无可靠 URL 来源，消费场景可由 `isSoloPanelPage`、`isViewPanelFullscreen` 和 URL 参数组合描述。
- [`resolved` 到 `DashboardControls` 的桥接职责] → 在 `DashboardScenePage`（或对应场景容器）通过 `useEffect` 调用 `dashboardControls.setState()`；不在 Scenes 对象内部调用 React hook，保持职责边界清晰。

## Migration Plan

1. 在新 change 下先完成 specs、design、tasks 文档并评审确认。
2. 实现 `useCustomKiosk`，先接入 Dashboard scene 路径，再补旧版 dashboard / solo panel 路径。
3. 接入页面容器和 panel 渲染层，补齐单测和组件测试。
4. 在测试环境启用 Auth Proxy 与代理透传，完成 iframe 联调。
5. 分阶段验证 dashboard 页面、solo panel 页面和无感认证场景。
6. 如需回滚，移除自定义参数消费逻辑并停止在嵌入链接中传递自定义参数；Auth Proxy 侧按配置关闭代理认证能力。

## Open Questions

- ~~是否需要在本次变更中统一覆盖 scene 路径和旧版 dashboard 路径的 footer/logo 行为，还是仅覆盖嵌入相关页面？~~ → 两条路径均覆盖，通过 `resolved.hideKioskFooter` 统一控制。
- ~~`hide_all` 是否需要显式影响 dashboard 页面中的其他辅助控件，例如变量区、links 区域？~~ → 已确认：`hide_all=true` 同时隐藏变量区和 Links 区（见归一化规则）。
- ~~单 panel 嵌入在现网中实际使用 `/d-solo` 还是 `viewPanel` 形式更多，是否需要双路径都给出明确验收用例？~~ → 两种路径均需覆盖，`viewPanel` 场景的 `hide_panel_menu` 行为已纳入测试矩阵（见 tasks.md 4.3），并在 `context` 层新增 `isViewPanelFullscreen` 字段支持。
- ~~`_dash.hideTimePicker` 拆分后的向后兼容语义是否确定？~~ → 已确定：`_dash.hideTimePicker=true` 继续同时隐藏 timePicker 和 refreshPicker；新增 `_dash.hideRefreshPicker` 独立控制 refreshPicker；自定义参数 `hide_time` 只控制 timePicker，`hide_refresh` 只控制 refreshPicker。
- ~~`context.isEmbeddedRoute` 是否应保留？~~ → 已移除，以 `isSoloPanelPage` 和 `isViewPanelFullscreen` 替代。