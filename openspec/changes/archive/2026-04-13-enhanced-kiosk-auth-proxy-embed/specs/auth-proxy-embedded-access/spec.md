## ADDED Requirements

### Requirement: Embedded access SHALL support Auth Proxy based seamless authentication
系统 MUST 支持在受信代理环境下通过 Auth Proxy 实现 iframe 嵌入页面的无感认证访问，避免在嵌入内容内出现单独的 Grafana 登录流程。

#### Scenario: Embedded page loads directly for authenticated platform user
- **WHEN** 用户已在监控平台登录，且平台代理请求向 Grafana 透传受信 Header
- **THEN** iframe 内 MUST 直接显示 Grafana 内容而不出现额外登录页

#### Scenario: User experience remains seamless in iframe
- **WHEN** 用户在监控平台中打开嵌入的 dashboard 或 panel 页面
- **THEN** 系统 MUST 避免中间登录跳转或额外认证提示破坏嵌入体验

### Requirement: Auth Proxy trust boundary SHALL remain server-side
前端展示控制 MUST NOT 被视为认证或权限控制手段，系统 MUST 仅信任来自受信代理白名单的身份 Header。

#### Scenario: Forged header from untrusted source is rejected
- **WHEN** 非白名单来源伪造 Auth Proxy 身份 Header 请求 Grafana
- **THEN** Grafana MUST 不信任该请求中的认证 Header

#### Scenario: DOM recovery does not grant additional access
- **WHEN** 用户通过浏览器工具恢复被隐藏的按钮或修改 DOM
- **THEN** 后端 MUST 仍按用户真实权限决定是否允许执行对应操作

### Requirement: Embedded access SHALL preserve existing query parameter semantics
增强型 kiosk 参数 MUST NOT 改变现有查询参数如 `from`、`to`、`refresh` 的业务语义与功能。

#### Scenario: Existing time range parameters continue to work
- **WHEN** 嵌入链接同时包含 `from`、`to` 与增强型 kiosk 参数
- **THEN** 系统 MUST 保持时间范围参数原有行为不变

#### Scenario: Existing refresh parameter continues to work
- **WHEN** 嵌入链接同时包含 `refresh` 与增强型 kiosk 参数
- **THEN** 系统 MUST 保持刷新参数原有的自动刷新能力不变

### Requirement: Authentication failure SHALL fall back to existing platform behavior
当 Auth Proxy 条件不满足时，系统 MUST 回退到现有 Grafana 认证与权限处理路径，而不是通过前端逻辑绕过认证。

#### Scenario: Direct access without trusted proxy follows deployment policy
- **WHEN** 用户直接访问 Grafana 地址且请求未经过受信代理
- **THEN** 系统 MUST 按部署策略进入现有登录或权限校验流程

#### Scenario: Proxy misconfiguration does not trigger client-side bypass
- **WHEN** 代理未正确注入用户 Header 或相关配置缺失
- **THEN** 前端 MUST NOT 通过 token 拼接或其他自定义方式绕过认证流程