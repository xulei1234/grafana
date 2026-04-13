---
name: react-code-review
description: 'Use when reviewing React or TypeScript frontend changes in this Grafana repository, especially for components, hooks, dashboard pages, scene code, rendering logic, state flow, and tests. Focus on behavior regressions, hook misuse, Grafana frontend patterns, missing Loading/Error/Empty states, accessibility gaps, and missing test coverage.'
argument-hint: 'Describe the PR, file set, or review focus'
user-invocable: true
---

# React Code Review

## When to Use

- 审查 React / TypeScript 前端改动。
- 审查 dashboard、scene、panel、页面容器、hooks、状态流相关改动。
- 需要按 Grafana 仓库约束检查 `useEffect`、条件渲染、类型、安全性与测试覆盖。
- 需要输出高信号 code review 结论，而不是实现建议清单。

## Review Output

- 先给 Findings，再给简短总结。
- Findings 按严重程度排序。
- 每条 Finding 必须说明：问题是什么、为什么有风险、可能影响什么。
- 优先报行为回归、运行时错误、状态流错误、权限/安全问题、缺失测试。
- 如果没有发现问题，明确写明“未发现明确缺陷”，再说明残余风险或测试空白。

## Checklist

### 1. 行为与回归

- 这次改动是否改变了原有默认行为、路由行为、参数语义或权限边界。
- 是否存在只覆盖新路径、遗漏旧路径的情况，尤其是 dashboard scene 与旧版 dashboard 并存路径。
- 是否引入了只在特定 query 参数、空数据、无权限或嵌入场景下才会暴露的问题。

### 2. React 与 Hooks

- 是否滥用 `useEffect` 派生内部数据流；若不是同步外部系统，应优先质疑。
- Hook 依赖是否正确，是否有闭包陈旧值、重复订阅、遗漏清理。
- 是否把解析 URL、派生状态、条件控制散落到多个组件，而不是集中封装。
- 条件渲染是否安全，避免 `list.length && ...` 这类会渲染 `0` 的写法。

### 3. Grafana 仓库模式

- 数据获取是否遵循现有模式；不要把请求逻辑随意塞进展示组件。
- `packages/ui` 不应引入业务 API 或业务状态。
- 变更是否复用了现有 AppChrome、DashboardControls、scene state、panel 渲染入口，而不是重复造轮子。
- 是否保持 strict TypeScript 风格，避免 `any`、弱类型透传和隐式类型逃逸。

### 4. UI 状态与体验

- 异步或条件展示是否覆盖 Loading、Error、Empty、Success。
- 禁用态、错误态、嵌入态、solo panel、kiosk 等边界状态是否一致。
- 是否引入明显的布局抖动、空白区域、不可达按钮或错误的显隐优先级。
- 关键交互是否满足基本 a11y，如按钮可聚焦、必要时有 `aria-label`。

### 5. 测试与可验证性

- 是否为新逻辑补了单测 / 组件测，尤其是参数优先级、显隐规则、hooks 输出。
- 是否缺少关键路径回归验证，例如 dashboard 页面、`/d-solo`、原生 `kiosk`、嵌入访问。
- 如果逻辑高度依赖组合参数或多路径渲染，测试是否覆盖正常路径、错误路径和边界条件。

## Review Heuristics

- 优先怀疑“看起来只是 UI 改动”的变更，因为它们常常改坏参数语义、布局层级或旧路径兼容性。
- 对共享 hook、全局 chrome、dashboard controls、路由层改动提高警惕，这些位置的回归面最大。
- 如果代码引入了新抽象，检查它是否真的减少重复，还是只是把复杂度换了个地方。
- 如果测试只覆盖 happy path，默认视为仍有 review 风险。

## Common Findings

- `kiosk`、自定义 query 参数、solo panel 路由之间的优先级不一致。
- `useEffect` 用于派生 state，导致重复 render 或状态不同步。
- scene 路径修了，旧版 dashboard / panel 路径没修。
- 展示层隐藏了按钮，但权限校验或实际行为边界未明确。
- 新增 UI 分支没有对应测试，后续升级 Grafana 容易回归。

## Example Prompts

- `/react-code-review 审查这个 dashboard scene 改动，重点看 query 参数与显隐逻辑`
- `/react-code-review 评审这组 React 组件和 hooks，重点看 useEffect、类型和测试`
- `/react-code-review 检查这次 Grafana 前端改动是否有嵌入场景或 kiosk 回归`