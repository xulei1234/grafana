# Copilot Instructions for Frontend Repository

> 本文件用于指导 GitHub Copilot Chat 在本仓库中的日常协助与代码生成行为。
>
> 声明：本仓库为 React 现代前端工程（严格 TypeScript + Monorepo），包含 `apps/web`、`packages/ui`、`packages/api` 等模块。
> 所有 OpenSpec 工作流规则以 `openspec/config.yaml` 为准。

---

## 1. 语言与回答偏好

- 默认使用**简体中文**进行回答。
- 给出的代码建议必须基于当前项目的上下文（React 函数式组件、TypeScript strict 模式）。
- 优先建议**最小化的改动**，切勿脱离上下文推翻现有架构或做大规模重构。

## 2. 核心代码生成准则

Copilot 在生成或重构代码时，必须强制遵守以下 React 前端规范：

### 2.1 依赖与引入限制
- 没有用户明确要求的指令时，**绝对禁止**建议引入如 `lodash`, `moment` 等大型库。优先使用原生 JS（ES6+）特性。
- 代码生成请参照项目现有的状态库（如 Zustand、React Query）与样式引擎（Tailwind / CSS Modules），不要混入项目中不存在的技术栈。

### 2.2 状态流与生命周期
- 严禁滥用 `useEffect`：除非是为了同步外部系统（挂载 DOM 事件、集成第三方非 React 库），不要用 `useEffect` 派生内部数据流。
- 后端数据拉取必须生成基于 **React Query** (`useQuery` / `useMutation`) 的代码片段。
- 在补全数据展示组件时，必须**主动包含 Loading、Error、Empty 的条件渲染分支**。

### 2.3 健壮性与防御性渲染
- 切勿写出隐式的假值渲染。例如：不要写 `list.length && <List />`（这会渲染出数字 0），必须写成 `list.length > 0 && <List />`。
- 函数组件必须明确定义 Props 定义，禁止使用 `any`。

## 3. 面向 Monorepo 的结构理解

基于项目结构，进行文件编辑与创建时的默认假设：
- **`packages/ui`**: 这里放置纯展现组件（Dumb Components），不能包含具体的业务 API 请求与数据。
- **`packages/api`**: 这里维护与后端对齐的请求方法和 Types，不包含 UI。
- **`apps/web`**: 这里放置业务拼装、路由划分与状态存储（Smart Components + 页面）。

## 4. 提供测试建议的要求

在被要求生成测试或被问及如何测试时：
- 偏向于提供基于 `@testing-library/react` (RTL) 的测试代码。
- 重点测试**渲染输出和用户交互**，例如使用 `screen.getByRole`、`userEvent.click`，而不要去测组件内部实现细节与状态 (`state` 的内部取值)。
- 如果涉及网络请求组件，建议配合 `msw` 做接口 Mock 的代码。

## 5. 日常使用风格建议

回答格式优先如下结构：
1. 问题理解（定位问题原因或需求点）。
2. 指明修改的文件及其所在的 package 范围。
3. 提供带完整上下文的代码片段修改。
4. 提醒可能影响的周边范围（如是否涉及 `Error` 边界遗漏、类型约束破坏）。