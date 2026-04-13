# 生产环境前端项目开发宪法

Version: 2.0  
Ratified: 2026-04-09

> 本文件定义本前端项目（SPA/SSR Monorepo）不可动摇的核心开发原则。
> 它适用于所有人类开发者、AI Agent 与自动化工作流。
>
> 优先级说明：
> 1. 本文件（最高工程原则）
> 2. `openspec/config.yaml`（工作流与产物执行规范）
> 3. `.github/copilot-instructions.md`（Copilot 交互辅助规范）

---

## 第一条：UI 状态的绝对完整 (UI State Completeness)

**核心：** 绝不让用户面对“无响应”、“白屏”或“隐式崩溃”。

- **1.1 四态齐备**：任何涉及异步数据呈现的组件，必须显式且正确地覆盖 `Loading`（加载）、`Empty`（空数据）、`Error`（异常/无权限/超时）和 `Success`（成功数据）四种状态。
- **1.2 禁用防呆防御**：涉及异步交互的表单与按钮，在提交状态下必须具有明确的显式 Loading 反馈并禁用二次交互。

## 第二条：状态分离与纯粹性 (State Separation & Purity)

**核心：** 正确区分 Server State 与 Client State，禁止将一切塞入同一状态树。

- **2.1 服务端状态**：所有涉及后端接口的数据获取、缓存、使失效（Invalidation）及轮询，必须通过 React Query 处理，禁止手动使用 `useEffect` 配合 `useState` 裸写请求逻辑。
- **2.2 客户端状态**：跨组件的全局 UI 状态经由 Zustand 维护；局部页面收敛状态优先使用组件本地 `useState` / `useReducer`。
- **2.3 URL 作为首要状态**：涉及分页、筛选、排序等具有分享 / 刷新恢复价值的状态，必须同步到 URL 及路由参数中，不能仅存留在内存。

## 第三条：类型的严格契约 (Strict Type Contract)

**核心：** TypeScript 的 Strict 模式即契约，前后端边界不可被破坏。

- **3.1 强类型与无 Any**：禁止引入隐式或显式 `any`，必须且仅使用强类型或 `unknown` 配合类型守卫。
- **3.2 API 契约至上**：与后端的契约结构必须通过 OpenAPI / API 文档严格映射到 `packages/api`。不允许在前端页面组件内随意“猜测”或重定义接口字段。

## 第四条：底线质量：性能与可访问性 (Performance & Accessibility)

**核心：** 交付给用户的必须是快速且面向全人类的产品。

- **4.1 性能控制**：严控不必要的全量重渲染。对首屏与核心路径的 Bundle 体积保持克制，未经 Proposal 明确评估，禁止引入大型第三方库。
- **4.2 基础 A11y**：所有关键交互元素（如按钮、弹窗、导航）必须具备基础的键盘可访问性，并按标准配置 `aria-label` 与焦点管理。

## 第五条：测试与工程兜底 (Testing & Engineering Defenses)

**核心：** 自动化代码质量保障优于人工记忆。

- **5.1 契约执行**：代码提交前必须通过 ESLint + Prettier 校验，这属于不可突破的技术红线。
- **5.2 测试全覆盖**：关键路径或组件库 (`packages/ui`) 必须包含基于 React Testing Library 的交互测试或 Vitest 单测。涉及核心业务流必须通过 E2E 验收或明确声明人工验收用例。