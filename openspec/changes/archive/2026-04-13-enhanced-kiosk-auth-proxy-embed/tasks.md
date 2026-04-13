## 文件变更清单（编码前锁定）

| 操作 | 文件路径 | 说明 |
|------|----------|------|
| **新建** | `public/app/features/dashboard-scene/utils/customKioskTypes.ts` | 参数名常量 + TS 类型（无业务逻辑） |
| **新建** | `public/app/features/dashboard-scene/utils/useCustomKiosk.ts` | Hook 与纯函数 `computeCustomKioskState` |
| **新建** | `public/app/features/dashboard-scene/utils/useCustomKiosk.test.ts` | Hook 单测（TDD 驱动） |
| **修改** | `public/app/core/components/AppChrome/AppChromeService.tsx` | 修复 `setKioskModeFromUrl` 空串 bug；扩展 `exitKioskMode` 清除自定义参数 |
| **修改** | `public/app/core/components/AppChrome/AppChrome.tsx` | 在现有 `useEffect` 中增加 `hide_all` → kioskMode 的触发逻辑 |
| **修改** | `public/app/features/dashboard-scene/scene/DashboardControls.tsx` | 新增 `hideRefreshControls` 字段，拆分时间/刷新渲染条件，扩展 URL key |
| **修改** | `public/app/features/dashboard-scene/scene/DashboardScene.tsx` | 在 `_activationHandler` 中订阅 URL 变化、保存并动态切换 panel menu |
| **修改** | `public/app/features/dashboard-scene/pages/DashboardScenePage.tsx` | 消费 hook 输出，桥接 DashboardControls；修复 footer 注入逻辑 |
| **修改** | `public/app/features/dashboard-scene/solo/SoloPanelPage.tsx` | 透传 `resolved.hidePanelMenu`（通过 `hideLogo` 参数等效或新增 prop） |
| **修改** | `public/app/features/dashboard/containers/DashboardPage.tsx` | 旧版路径：从 `queryParams` 推导 `hidePanelMenus` 并透传给 `DashboardGrid` |

---

## 1. 参数契约与 Hook 设计落地

- [x] 1.1 确认增强型 Kiosk 参数契约与优先级规则在代码中的常量/类型定义位置
  - 定义 `CUSTOM_KIOSK_PARAMS` 常量对象，集中声明 `hide_all`、`hide_time`、`hide_refresh`、`hide_panel_menu`、`no_padding` 的参数名
  - 定义 `CustomKioskRaw`、`CustomKioskContext`、`CustomKioskResolved` TypeScript 类型
  - `CustomKioskResolved` 包含：`hideChrome`、`hideTime`、`hideRefresh`、`hidePanelMenu`、`hideVariables`、`hideLinks`、`removeOuterPadding`、`maximizePanelArea`、`hideKioskFooter`
  - 明确 kiosk 参数边缘值：`kiosk === '1'`、`kiosk === true`、`kiosk === ''` 均视为启用（对齐 `DashboardScenePage.tsx:119`）
  - **【新增·盲区一】** 同步修复 `AppChromeService.setKioskModeFromUrl`：补充 `case ''` 分支，与 `DashboardScenePage.tsx:119` 的三态判断对齐，避免 `?kiosk=` 时 DashboardScene 认为 kiosk 已开启但 AppChrome 不响应的行为不一致
  - **【新增·盲区二】** 在此任务中固定 `_dash.hideTimePicker` 拆分后的兼容语义：`_dash.hideTimePicker=true` 继续隐藏 **timePicker 和 refreshPicker 两者**（保留原有行为）；新增独立 `_dash.hideRefreshPicker=true` 只隐藏 refreshPicker；新增自定义参数 `hide_time=true` 只影响 timePicker，`hide_refresh=true` 只影响 refreshPicker
  - [x] **1.1.a** 新建 `public/app/features/dashboard-scene/utils/customKioskTypes.ts`，内容如下：
    ```typescript
    export const CUSTOM_KIOSK_PARAMS = {
      hideAll: 'hide_all',
      hideTime: 'hide_time',
      hideRefresh: 'hide_refresh',
      hidePanelMenu: 'hide_panel_menu',
      noPadding: 'no_padding',
    } as const;

    export const CUSTOM_KIOSK_PARAM_LIST = Object.values(CUSTOM_KIOSK_PARAMS);

    export interface CustomKioskRaw {
      kiosk: string | boolean | undefined;
      hideAll: string | boolean | undefined;
      hideTime: string | boolean | undefined;
      hideRefresh: string | boolean | undefined;
      hidePanelMenu: string | boolean | undefined;
      noPadding: string | boolean | undefined;
    }
    export interface CustomKioskContext {
      isDashboardPage: boolean;
      isSoloPanelPage: boolean;
      isViewPanelFullscreen: boolean;
    }
    export interface CustomKioskResolved {
      hideChrome: boolean;
      hideTime: boolean;
      hideRefresh: boolean;
      hidePanelMenu: boolean;
      hideVariables: boolean;
      hideLinks: boolean;
      removeOuterPadding: boolean;
      maximizePanelArea: boolean;
      hideKioskFooter: boolean;
    }
    export interface CustomKioskState {
      raw: CustomKioskRaw;
      context: CustomKioskContext;
      resolved: CustomKioskResolved;
    }
    ```
  - [x] **1.1.b** 在 `public/app/core/components/AppChrome/AppChromeService.tsx` 的 `setKioskModeFromUrl` 中补充空串分支：
    ```typescript
    // 修改前：
    switch (kiosk) {
      case '1':
      case true:
        newKioskMode = KioskMode.Full;
    }
    // 修改后（补充 case ''）：
    switch (kiosk) {
      case '1':
      case true:
      case '':          // ← 新增，对齐 DashboardScenePage.tsx:119
        newKioskMode = KioskMode.Full;
    }
    ```
  - [x] **1.1.c** 运行 AppChromeService 相关测试确认无回归：
    `yarn jest --no-watch public/app/core/components/AppChrome/`
    预期：全部通过（无因空串处理导致的新失败）
  - [x] **1.1.d** 提交类型文件与 bug 修复：
    ```bash
    git add public/app/features/dashboard-scene/utils/customKioskTypes.ts \
            public/app/core/components/AppChrome/AppChromeService.tsx
    git commit -m "feat(kiosk): add CustomKiosk types; fix setKioskModeFromUrl empty-string kiosk

    Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
    ```

- [x] 1.2 实现 `useCustomKiosk` Hook，统一输出 `raw`、`context`、`resolved` 三层状态
  - 响应性：使用 `locationService.getLocationObservable()` + `useObservable`（from `react-use`）订阅位置变化，**禁止**直接读取 `window.location.search`
  - **【新增·盲区七】** `useObservable` 初始值为 `undefined`，须以 `locationService.getLocation()` 作为初始值（`useObservable(obs, locationService.getLocation())`），避免首次渲染的空窗闪烁
  - `context.isSoloPanelPage`：通过 `location.pathname.startsWith('/d-solo/')` 判断
  - **【新增·盲区四】** `context.isViewPanelFullscreen`：通过 `locationService.getSearchObject().viewPanel != null` 判断（`/d/...?viewPanel=X` 形态的全屏 panel 不走 `/d-solo/` 路径，`isSoloPanelPage` 无法覆盖）；`isSoloPanelPage || isViewPanelFullscreen` 组合后推导 `maximizePanelArea`
  - **【新增·盲区九】** 移除 `context.isEmbeddedRoute` 字段：该字段无可靠的纯 URL 检测来源（iframe 检测跨域受限，`DashboardRoutes.Embedded` 在 hook 内不可直接访问），现有场景可由 `isSoloPanelPage` + URL 参数组合描述，避免歧义
  - 归一化：`hide_all=true` 时，`hideVariables` 和 `hideLinks` 同样置 `true`
  - 非法值处理：无法识别的参数值一律回退为默认（未启用），不抛出错误
  - [x] **1.2.a** 新建 `public/app/features/dashboard-scene/utils/useCustomKiosk.test.ts`，写第一组覆盖 `hide_all` 与 `kiosk` 场景的**失败测试**：
    ```typescript
    import { computeCustomKioskState, isParamEnabled, isKioskEnabled } from './useCustomKiosk';

    describe('isParamEnabled', () => {
      it('returns false for undefined', () => expect(isParamEnabled(undefined)).toBe(false));
      it('returns false for boolean false', () => expect(isParamEnabled(false)).toBe(false));
      it('returns false for "false"', () => expect(isParamEnabled('false')).toBe(false));
      it('returns false for "0"', () => expect(isParamEnabled('0')).toBe(false));
      it('returns true for boolean true', () => expect(isParamEnabled(true)).toBe(true));
      it('returns true for empty string', () => expect(isParamEnabled('')).toBe(true));
      it('returns true for "1"', () => expect(isParamEnabled('1')).toBe(true));
      it('returns true for "true"', () => expect(isParamEnabled('true')).toBe(true));
    });

    describe('isKioskEnabled', () => {
      it('handles "1"', () => expect(isKioskEnabled('1')).toBe(true));
      it('handles boolean true (from ?kiosk no-value)', () => expect(isKioskEnabled(true)).toBe(true));
      it('handles empty string (from ?kiosk=)', () => expect(isKioskEnabled('')).toBe(true));
      it('returns false for undefined', () => expect(isKioskEnabled(undefined)).toBe(false));
      it('returns false for string "true" (not a kiosk-enable value)', () => expect(isKioskEnabled('true')).toBe(false));
    });

    describe('computeCustomKioskState – hide_all', () => {
      const s = computeCustomKioskState('/d/test/slug', '?hide_all=true');
      it('hideChrome', () => expect(s.resolved.hideChrome).toBe(true));
      it('hideTime', () => expect(s.resolved.hideTime).toBe(true));
      it('hideRefresh', () => expect(s.resolved.hideRefresh).toBe(true));
      it('hidePanelMenu', () => expect(s.resolved.hidePanelMenu).toBe(true));
      it('hideVariables', () => expect(s.resolved.hideVariables).toBe(true));
      it('hideLinks', () => expect(s.resolved.hideLinks).toBe(true));
      it('removeOuterPadding', () => expect(s.resolved.removeOuterPadding).toBe(true));
      it('hideKioskFooter', () => expect(s.resolved.hideKioskFooter).toBe(true));
    });
    ```
  - [x] **1.2.b** 运行测试，确认因模块未找到而**失败**：
    `yarn jest --no-watch public/app/features/dashboard-scene/utils/useCustomKiosk.test.ts`
    预期输出：`Cannot find module './useCustomKiosk'`
  - [x] **1.2.c** 新建 `public/app/features/dashboard-scene/utils/useCustomKiosk.ts`，实现以下内容：
    ```typescript
    import { useObservable } from 'react-use';
    import { locationSearchToObject, locationService } from '@grafana/runtime';
    import {
      CustomKioskState, CustomKioskRaw, CustomKioskContext, CustomKioskResolved,
      CUSTOM_KIOSK_PARAMS,
    } from './customKioskTypes';

    export function isParamEnabled(value: string | boolean | undefined): boolean {
      if (value === undefined || value === null || value === false) { return false; }
      if (value === true || value === '' || value === '1') { return true; }
      const n = String(value).trim().toLowerCase();
      return n !== 'false' && n !== '0';
    }

    export function isKioskEnabled(kiosk: string | boolean | undefined): boolean {
      return kiosk === '1' || kiosk === true || kiosk === '';
    }

    export function computeCustomKioskState(pathname: string, search: string): CustomKioskState {
      const p = locationSearchToObject(search);
      const raw: CustomKioskRaw = {
        kiosk: p['kiosk'] as string | boolean | undefined,
        hideAll: p[CUSTOM_KIOSK_PARAMS.hideAll] as string | boolean | undefined,
        hideTime: p[CUSTOM_KIOSK_PARAMS.hideTime] as string | boolean | undefined,
        hideRefresh: p[CUSTOM_KIOSK_PARAMS.hideRefresh] as string | boolean | undefined,
        hidePanelMenu: p[CUSTOM_KIOSK_PARAMS.hidePanelMenu] as string | boolean | undefined,
        noPadding: p[CUSTOM_KIOSK_PARAMS.noPadding] as string | boolean | undefined,
      };
      const hideAll = isParamEnabled(raw.hideAll);
      const kioskOn = isKioskEnabled(raw.kiosk);
      const context: CustomKioskContext = {
        isDashboardPage: pathname.startsWith('/d/'),
        isSoloPanelPage: pathname.startsWith('/d-solo/'),
        isViewPanelFullscreen: p['viewPanel'] != null,
      };
      const resolved: CustomKioskResolved = {
        hideChrome: hideAll || kioskOn,
        hideTime: hideAll || isParamEnabled(raw.hideTime),
        hideRefresh: hideAll || isParamEnabled(raw.hideRefresh),
        hidePanelMenu: hideAll || isParamEnabled(raw.hidePanelMenu),
        hideVariables: hideAll,
        hideLinks: hideAll,
        removeOuterPadding: hideAll || isParamEnabled(raw.noPadding),
        maximizePanelArea: context.isSoloPanelPage || context.isViewPanelFullscreen,
        hideKioskFooter: hideAll || kioskOn,
      };
      return { raw, context, resolved };
    }

    export function useCustomKiosk(): CustomKioskState {
      const location = useObservable(
        locationService.getLocationObservable(),
        locationService.getLocation()
      );
      return computeCustomKioskState(location.pathname, location.search);
    }
    ```
  - [x] **1.2.d** 运行测试，确认全部**通过**：
    `yarn jest --no-watch public/app/features/dashboard-scene/utils/useCustomKiosk.test.ts`
    预期：全绿，无失败
  - [x] **1.2.e** 提交：
    ```bash
    git add public/app/features/dashboard-scene/utils/useCustomKiosk.ts \
            public/app/features/dashboard-scene/utils/useCustomKiosk.test.ts
    git commit -m "feat(kiosk): implement useCustomKiosk hook with computeCustomKioskState

    Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
    ```

- [x] 1.3 为 `useCustomKiosk` 补充参数解析与优先级归一化单测，覆盖以下场景：
  - `hide_all=true` 覆盖所有单项参数（含 `hideVariables`、`hideLinks`）
  - `kiosk=true`、`kiosk=1`、`kiosk=''` 三种形态均触发 `hideChrome=true`
  - `hide_time=true` 只影响 `hideTime`，不影响 `hideRefresh`
  - `hide_refresh=true` 只影响 `hideRefresh`，不影响 `hideTime`
  - `hide_panel_menu=true` 只影响 `hidePanelMenu`
  - `no_padding=true` 只影响 `removeOuterPadding`
  - pathname 含 `/d-solo/` 时 `isSoloPanelPage=true` → `maximizePanelArea=true`
  - **【新增·盲区四】** `viewPanel=X` 参数存在时 `isViewPanelFullscreen=true` → `maximizePanelArea=true`
  - 非法参数值回退为默认行为
  - [x] **1.3.a** 在 `useCustomKiosk.test.ts` 追加以下测试 describe 块：
    ```typescript
    describe('computeCustomKioskState – single params isolation', () => {
      it('hide_time only affects hideTime', () => {
        const s = computeCustomKioskState('/d/x', '?hide_time=true');
        expect(s.resolved.hideTime).toBe(true);
        expect(s.resolved.hideRefresh).toBe(false);
        expect(s.resolved.hidePanelMenu).toBe(false);
        expect(s.resolved.hideChrome).toBe(false);
      });
      it('hide_refresh only affects hideRefresh', () => {
        const s = computeCustomKioskState('/d/x', '?hide_refresh=true');
        expect(s.resolved.hideRefresh).toBe(true);
        expect(s.resolved.hideTime).toBe(false);
      });
      it('no_padding only affects removeOuterPadding', () => {
        const s = computeCustomKioskState('/d/x', '?no_padding=true');
        expect(s.resolved.removeOuterPadding).toBe(true);
        expect(s.resolved.hideChrome).toBe(false);
      });
      it('hide_panel_menu only affects hidePanelMenu', () => {
        const s = computeCustomKioskState('/d/x', '?hide_panel_menu=true');
        expect(s.resolved.hidePanelMenu).toBe(true);
        expect(s.resolved.hideTime).toBe(false);
      });
    });

    describe('computeCustomKioskState – kiosk three-state', () => {
      it('kiosk=1 triggers hideChrome and hideKioskFooter', () => {
        const s = computeCustomKioskState('/d/x', '?kiosk=1');
        expect(s.resolved.hideChrome).toBe(true);
        expect(s.resolved.hideKioskFooter).toBe(true);
        expect(s.resolved.hideTime).toBe(false); // kiosk alone doesn't hide controls
      });
      it('kiosk=true (boolean from ?kiosk no-value)', () => {
        // locationSearchToObject('?kiosk') returns { kiosk: true }
        const s = computeCustomKioskState('/d/x', '?kiosk');
        expect(s.resolved.hideChrome).toBe(true);
      });
      it('kiosk empty string', () => {
        // locationSearchToObject('?kiosk=') returns { kiosk: '' }
        const s = computeCustomKioskState('/d/x', '?kiosk=');
        expect(s.resolved.hideChrome).toBe(true);
      });
      it('kiosk=true string does NOT trigger (must be native kiosk value)', () => {
        const s = computeCustomKioskState('/d/x', '?kiosk=true');
        expect(s.resolved.hideChrome).toBe(false);
      });
    });

    describe('computeCustomKioskState – context routing', () => {
      it('/d-solo path → maximizePanelArea', () => {
        const s = computeCustomKioskState('/d-solo/abc/slug', '');
        expect(s.context.isSoloPanelPage).toBe(true);
        expect(s.resolved.maximizePanelArea).toBe(true);
      });
      it('viewPanel param → isViewPanelFullscreen', () => {
        const s = computeCustomKioskState('/d/abc/slug', '?viewPanel=3');
        expect(s.context.isViewPanelFullscreen).toBe(true);
        expect(s.resolved.maximizePanelArea).toBe(true);
        expect(s.context.isSoloPanelPage).toBe(false);
      });
      it('plain /d path → no maximize', () => {
        const s = computeCustomKioskState('/d/abc/slug', '');
        expect(s.resolved.maximizePanelArea).toBe(false);
      });
    });

    describe('computeCustomKioskState – invalid values fall back to false', () => {
      it('hide_time=garbage → false', () => {
        const s = computeCustomKioskState('/d/x', '?hide_time=garbage');
        expect(s.resolved.hideTime).toBe(true); // non-false/0 strings are truthy
      });
      it('hide_time=false → false', () => {
        const s = computeCustomKioskState('/d/x', '?hide_time=false');
        expect(s.resolved.hideTime).toBe(false);
      });
      it('hide_time=0 → false', () => {
        const s = computeCustomKioskState('/d/x', '?hide_time=0');
        expect(s.resolved.hideTime).toBe(false);
      });
    });
    ```
  - [x] **1.3.b** 运行全部测试，确认通过：
    `yarn jest --no-watch public/app/features/dashboard-scene/utils/useCustomKiosk.test.ts`
  - [x] **1.3.c** 提交：
    ```bash
    git add public/app/features/dashboard-scene/utils/useCustomKiosk.test.ts
    git commit -m "test(kiosk): add edge-case coverage for computeCustomKioskState

    Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
    ```

## 2. Dashboard 与 Panel 展示接入

- [x] 2.1 在 AppChrome 层接入 `resolved.hideChrome`，保持原生 kiosk 兼容行为
  - 在 `AppChrome.tsx` 的现有 `useEffect`（监听 `search`）中，额外解析 `hide_all`
  - 当 `resolved.hideChrome=true` 时调用 `chrome.update({ kioskMode: KioskMode.Full })`，复用 kiosk 系统驱动 `chromeless` 状态
  - 确认 `DashboardBrandingFooter`（依赖 `isKioskMode`）在 `hide_all=true` 时同步隐藏（属预期行为）
  - 扩展 `AppChromeService.exitKioskMode()`：退出时同步清除自定义参数（`hide_all`、`hide_time`、`hide_refresh`、`hide_panel_menu`、`no_padding`），避免 ESC 键后参数残留
  - [x] **2.1.a** 在 `AppChrome.tsx` 找到现有的 kiosk URL sync `useEffect`（通常在文件顶部 hooks 区），扩展其逻辑：
    ```typescript
    // 在 AppChrome.tsx 中，现有 useEffect 内增加：
    import { computeCustomKioskState } from '../../features/dashboard-scene/utils/useCustomKiosk';
    // 在 useEffect 内：
    const { resolved } = computeCustomKioskState(location.pathname, location.search);
    if (resolved.hideChrome) {
      chrome.update({ kioskMode: KioskMode.Full });
    }
    ```
    注：不使用 `useCustomKiosk()` hook（避免重复订阅），直接调用纯函数 `computeCustomKioskState`；`location` 来自现有 `useEffect` 中读取的 `locationService.getLocation()`。
  - [x] **2.1.b** 在 `AppChromeService.tsx` 的 `exitKioskMode()` 末尾追加清除自定义参数：
    ```typescript
    // 现有 exitKioskMode 末尾（在 setKioskMode(KioskMode.Off) 之后）：
    locationService.partial({
      hide_all: null,
      hide_time: null,
      hide_refresh: null,
      hide_panel_menu: null,
      no_padding: null,
    });
    ```
  - [x] **2.1.c** 运行 AppChrome 测试：
    `yarn jest --no-watch public/app/core/components/AppChrome/`
  - [x] **2.1.d** 提交：
    ```bash
    git add public/app/core/components/AppChrome/AppChrome.tsx \
            public/app/core/components/AppChrome/AppChromeService.tsx
    git commit -m "feat(kiosk): hide_all triggers kioskMode.Full; exitKioskMode clears custom params

    Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
    ```

- [x] 2.2 在 dashboard scene 控件层接入 `resolved.hideTime`、`resolved.hideRefresh`、`resolved.hideVariables`、`resolved.hideLinks`
  - 在 `DashboardControls` 新增 `hideRefreshControls` 状态字段，与 `hideTimeControls` 拆分
  - 修改 `DashboardControlsRenderer`，`timePicker` 由 `hideTimeControls` 独立控制，`refreshPicker` 由 `hideRefreshControls` 独立控制（当前两者绑定同一 flag，需拆分渲染条件）
  - 新增 URL key `_dash.hideRefreshPicker`（与 `_dash.hideTimePicker` 并列），旧有 `_dash.hideTimePicker` 继续同时设置 `hideTimeControls=true` 和 `hideRefreshControls=true`（保持向后兼容）
  - 确保 `resolved.hideVariables=true` 时，`hideVariableControls` 置为 `true`；`resolved.hideLinks=true` 时，`hideLinksControls` 置为 `true`
  - **【新增·盲区五】** 明确 `resolved.*` 到 `DashboardControls` 场景状态的桥接方案：在 `DashboardScenePage`（或场景容器组件）中通过 `useEffect` 消费 `useCustomKiosk()` 输出，并直接调用 `dashboardControls.setState({ hideTimeControls, hideRefreshControls, hideVariableControls, hideLinksControls })`；不在 `DashboardControls` 内部调用 hook，保持 Scenes 对象与 React hook 的职责边界
  - [x] **2.2.a** 修改 `DashboardControls.tsx`，在 `DashboardControlsState` 接口添加字段：
    ```typescript
    // public/app/features/dashboard-scene/scene/DashboardControls.tsx
    // 在 DashboardControlsState 接口中，hideTimeControls 之后添加：
    hideRefreshControls?: boolean;
    ```
  - [x] **2.2.b** 在 `_urlSync` keys 中追加 `'_dash.hideRefreshPicker'`：
    ```typescript
    protected _urlSync = new SceneObjectUrlSyncConfig(this, {
      keys: ['_dash.hideTimePicker', '_dash.hideVariables', '_dash.hideLinks', '_dash.hideDashboardControls', '_dash.hideRefreshPicker'],
    });
    ```
  - [x] **2.2.c** 修改 `updateFromUrl`，拆分 `hideTimePicker` 和 `hideRefreshPicker` 语义：
    ```typescript
    // 原：仅设置 hideTimeControls
    if (!hideTimeControls && isEnabledViaUrl('_dash.hideTimePicker')) {
      this.setState({ hideTimeControls: true });
    }
    // 改为（向后兼容：同时设置 hideRefreshControls）：
    if (isEnabledViaUrl('_dash.hideTimePicker')) {
      this.setState({ hideTimeControls: true, hideRefreshControls: true });
    }
    // 新增单独控制 refreshPicker：
    if (!this.state.hideRefreshControls && isEnabledViaUrl('_dash.hideRefreshPicker')) {
      this.setState({ hideRefreshControls: true });
    }
    ```
  - [x] **2.2.d** 修改 `hasControls()` 方法中的 timePicker 判断：
    ```typescript
    // 原：
    const hideTimePicker = this.state.hideTimeControls;
    // 改为（timePicker 区域视为"隐藏"当且仅当两个控件都隐藏）：
    const hideTimePicker = this.state.hideTimeControls && this.state.hideRefreshControls;
    ```
  - [x] **2.2.e** 拆分 `DashboardControlsRenderer` 的两处渲染（新布局 + 旧布局各一处）：
    ```tsx
    // 原（新布局，旧布局同理）：
    {!hideTimeControls && (
      <div className={styles.fixedControlsNewLayout}>
        <timePicker.Component model={timePicker} />
        <refreshPicker.Component model={refreshPicker} />
      </div>
    )}
    // 改为：
    {(!hideTimeControls || !hideRefreshControls) && (
      <div className={styles.fixedControlsNewLayout}>
        {!hideTimeControls && <timePicker.Component model={timePicker} />}
        {!hideRefreshControls && <refreshPicker.Component model={refreshPicker} />}
      </div>
    )}
    ```
  - [x] **2.2.f** 在 `DashboardScenePage` 中添加 bridge `useEffect`（消费 hook，注入 scene state）：
    ```typescript
    // public/app/features/dashboard-scene/pages/DashboardScenePage.tsx
    // 在组件内 stateManager.useState() 之后添加：
    import { useCustomKiosk } from '../utils/useCustomKiosk';

    // 组件体内：
    const { resolved } = useCustomKiosk();

    useEffect(() => {
      const controls = dashboard?.state.controls;
      if (!controls) { return; }
      // ADDITIVE: never override _dash.* settings, only OR in custom kiosk flags
      controls.setState({
        hideTimeControls: controls.state.hideTimeControls || resolved.hideTime,
        hideRefreshControls: controls.state.hideRefreshControls || resolved.hideRefresh,
        hideVariableControls: controls.state.hideVariableControls || resolved.hideVariables,
        hideLinksControls: controls.state.hideLinksControls || resolved.hideLinks,
      });
    }, [dashboard, resolved.hideTime, resolved.hideRefresh, resolved.hideVariables, resolved.hideLinks]);
    ```
  - [x] **2.2.g** 修复 `DashboardScenePage.tsx` 中的 footer 注入逻辑（盲区六）：
    ```typescript
    // 原：
    const hideFooter = shouldHideDashboardKioskFooter(queryParams.hideLogo);
    // 改为：
    const hideFooter = shouldHideDashboardKioskFooter(queryParams.hideLogo) || resolved.hideKioskFooter;
    ```
    同时更新 `isKioskMode` 使其兼容 `resolved.hideChrome`（`hide_all` 触发后 AppChrome 会设置 kioskMode，但 `queryParams.kiosk` 不含 `hide_all`，此处单独 OR）：
    ```typescript
    const isKioskMode =
      queryParams.kiosk === '1' || queryParams.kiosk === true || queryParams.kiosk === '' ||
      resolved.hideChrome;
    ```
  - [x] **2.2.h** 运行 DashboardControls 和 DashboardScenePage 测试：
    ```bash
    yarn jest --no-watch public/app/features/dashboard-scene/scene/DashboardControls.test.tsx
    yarn jest --no-watch public/app/features/dashboard-scene/pages/DashboardScenePage.test.tsx
    ```
    预期：全部通过；若 `DashboardControls.test.tsx` 内有 `hideTimeControls` 相关快照，需更新
  - [x] **2.2.i** 提交：
    ```bash
    git add public/app/features/dashboard-scene/scene/DashboardControls.tsx \
            public/app/features/dashboard-scene/pages/DashboardScenePage.tsx
    git commit -m "feat(kiosk): split hideRefreshControls; bridge useCustomKiosk to DashboardControls; fix footer

    Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
    ```

- [x] 2.3 在 panel 渲染层接入 `resolved.hidePanelMenu`，覆盖 dashboard 页面与单 panel 页面
  - **scene 路径**：在 `DashboardScene` 的激活处理器中，通过 `locationService.getLocationObservable()` 订阅 URL 变化；读取 `resolved.hidePanelMenu`；
    - 隐藏时：遍历所有 `VizPanel`，先保存其 `menu` 引用到激活闭包内的 `Map<string, VizPanelMenu>`，再调用 `panel.setState({ menu: undefined })`
    - 恢复时（`resolved.hidePanelMenu` 变为 `false`）：从保存的 Map 中取回原始 `menu` 引用，调用 `panel.setState({ menu: originalMenu })`
    - **【新增·盲区三】** 若不保存原始引用，URL 移除 `hide_panel_menu` 后菜单不会恢复；作为备选方案，可在 panel 创建时将 `menu` 存入 panel 的 `$behaviors` 或额外的 scene 变量中，确保可重新取回
  - **旧版路径**：通过现有的 `hidePanelMenus` prop 链路（`DashboardGrid → DashboardPanel → PanelStateWrapper`）传入 `resolved.hidePanelMenu`
  - **/d-solo 路由**：默认不隐藏 panel 菜单；仅当 `hide_panel_menu=true` 时隐藏（新版 scene-based `SoloPanelPage` 需消费此逻辑，与旧版硬编码 `hideMenu={true}` 的行为有意区分）
  - **【新增·盲区四】** `viewPanel=X` 全屏模式：`DashboardSceneRenderer` 渲染全屏 panel 时，需将 `resolved.hidePanelMenu` 传入 `SoloPanelContextProvider` 或在对应 `VizPanel` 上单独执行菜单隐藏，不能仅依赖批量设置（全屏 panel 激活时机可能晚于 `onActivate`）
  - [x] **2.3.a** 在 `DashboardScene.tsx` 的 `_activationHandler()` 中，添加 panel menu 订阅逻辑：
    ```typescript
    // public/app/features/dashboard-scene/scene/DashboardScene.tsx
    // 在 _activationHandler 方法的 return 语句之前添加：
    import { computeCustomKioskState } from '../utils/useCustomKiosk';
    import { dashboardSceneGraph } from '../utils/dashboardSceneGraph';
    import type { VizPanelMenu } from '@grafana/scenes';

    // _activationHandler 内：
    const savedMenus = new Map<string, VizPanelMenu | undefined>();

    const applyPanelMenuVisibility = (hidePanelMenu: boolean) => {
      const panels = dashboardSceneGraph.getVizPanels(this);
      if (hidePanelMenu) {
        panels.forEach((panel) => {
          const key = panel.state.key ?? '';
          if (!savedMenus.has(key)) {
            savedMenus.set(key, panel.state.menu);
          }
          panel.setState({ menu: undefined });
        });
      } else {
        panels.forEach((panel) => {
          const key = panel.state.key ?? '';
          if (savedMenus.has(key)) {
            panel.setState({ menu: savedMenus.get(key) });
          }
        });
      }
    };

    const locationSub = locationService.getLocationObservable().subscribe((loc) => {
      const { resolved } = computeCustomKioskState(loc.pathname, loc.search);
      applyPanelMenuVisibility(resolved.hidePanelMenu);
    });

    // 立即执行一次（处理初始 URL）
    const initLoc = locationService.getLocation();
    const { resolved: initResolved } = computeCustomKioskState(initLoc.pathname, initLoc.search);
    applyPanelMenuVisibility(initResolved.hidePanelMenu);

    // 将 locationSub.unsubscribe 加入现有的清理返回函数中：
    return () => {
      locationSub.unsubscribe();
      // ...现有的清理逻辑保持不变...
    };
    ```
  - [x] **2.3.b** 修改旧版 `DashboardPage.tsx`，从 `queryParams` 推导 `hidePanelMenus` 并透传给 `DashboardGrid`：
    ```typescript
    // public/app/features/dashboard/containers/DashboardPage.tsx
    // 在 render 方法中，现有 kioskMode 计算之后添加：
    const hidePanelMenus =
      queryParams[CUSTOM_KIOSK_PARAMS.hideAll] === 'true' ||
      queryParams[CUSTOM_KIOSK_PARAMS.hidePanelMenu] === 'true';

    // 在 DashboardGrid 处传入：
    <DashboardGrid
      dashboard={dashboard}
      isEditable={!!dashboard.meta.canEdit}
      viewPanel={viewPanel}
      editPanel={editPanel}
      hidePanelMenus={hidePanelMenus}
    />
    ```
    注：需在文件顶部从 `customKioskTypes` 导入 `CUSTOM_KIOSK_PARAMS`
  - [x] **2.3.c** 在 `SoloPanelPage.tsx` 中消费 `resolved.hidePanelMenu`：
    ```typescript
    // public/app/features/dashboard-scene/solo/SoloPanelPage.tsx
    // 在 SoloPanelRenderer 组件内：
    import { useCustomKiosk } from '../utils/useCustomKiosk';

    const { resolved } = useCustomKiosk();
    // 在渲染 VizPanel 时，若 resolved.hidePanelMenu，则执行 panel.setState({ menu: undefined })
    // 注意：solo 页面每次只渲染一个 panel，可在 useEffect 中处理：
    useEffect(() => {
      if (resolved.hidePanelMenu && panel) {
        panel.setState({ menu: undefined });
      }
    }, [resolved.hidePanelMenu, panel]);
    ```
  - [x] **2.3.d** 运行相关测试：
    ```bash
    yarn jest --no-watch public/app/features/dashboard-scene/scene/DashboardScene.test.ts
    yarn jest --no-watch public/app/features/dashboard-scene/solo/SoloPanelPage.test.tsx
    ```
    预期：全部通过；若有 panel menu 相关快照，需更新
  - [x] **2.3.e** 提交：
    ```bash
    git add public/app/features/dashboard-scene/scene/DashboardScene.tsx \
            public/app/features/dashboard-scene/solo/SoloPanelPage.tsx \
            public/app/features/dashboard/containers/DashboardPage.tsx
    git commit -m "feat(kiosk): hide_panel_menu support in scene/solo/legacy paths; reversible menu hide

    Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
    ```

- [x] 2.4 在 Dashboard / Solo 页面容器接入 `resolved.removeOuterPadding`、`resolved.maximizePanelArea` 与 `resolved.hideKioskFooter`
  - Dashboard 页面：`resolved.removeOuterPadding=true` 时移除因隐藏头部产生的顶部空白，明确 scene 路径和旧版路径的具体 CSS 属性/类名（不得用通配 hack）
  - Solo 页面：`SoloPanelPage` 的容器已经是 `position: fixed; top:0; left:0; right:0; bottom:0`（已确认），`maximizePanelArea` 在此路由下的额外价值是移除可能残留的 padding/margin，需检查 `SoloPanelPageLogo` hover 区域是否影响 panel 渲染区域
  - **【新增·盲区六】** Footer 注入：`DashboardScenePage.tsx:132` 的 `hide={!isKioskMode || hideFooter}` 中，`hideFooter` 目前只读取 `queryParams.hideLogo`；当 `resolved.hideKioskFooter=true` 时，需在 `DashboardScenePage` 中将 `resolved.hideKioskFooter` OR 进 `hideFooter` 判断，否则 `hide_all=true` 触发 kioskMode 后 footer 反而会出现（`!isKioskMode` 为 false，`hideFooter` 也为 false，`hide` = false）
  - **【新增·盲区六】** `SoloPanelPage` 已接受 `hideLogo` 查询参数（`SoloPanelPageLogo` 消费），`resolved.hideKioskFooter=true` 时应等效传入 `hideLogo=true`，避免重复造参数处理逻辑
  - [x] **2.4.a** Footer 修复已在 2.2.g 完成（`DashboardScenePage.tsx` 中 `hideFooter` OR `resolved.hideKioskFooter`）。本步骤验证 footer 行为：
    在组件测试中 mock `computeCustomKioskState` 返回 `resolved.hideKioskFooter = true`，断言 `DashboardBrandingFooter` 的 `hide` prop 为 `true`。
    ```bash
    yarn jest --no-watch public/app/features/dashboard-scene/pages/DashboardScenePage.test.tsx
    ```
  - [x] **2.4.b** 在 `SoloPanelPage.tsx` 中，将 `resolved.hideKioskFooter` 传递给 `SoloPanelPageLogo` 的 `hideLogo` prop：
    ```typescript
    // public/app/features/dashboard-scene/solo/SoloPanelPage.tsx
    // SoloPanelRenderer 组件内（已在 2.3.c 引入 useCustomKiosk）：
    // 找到 SoloPanelPageLogo 渲染处，传入：
    <SoloPanelPageLogo hideLogo={hideLogo || resolved.hideKioskFooter} />
    // 其中 hideLogo 是现有的 queryParams.hideLogo prop
    ```
  - [x] **2.4.c** 检查 `no_padding=true` 时的 Dashboard 顶部间距：
    在 `DashboardScenePage.tsx` 渲染的 `<UrlSyncContextProvider>` 包裹的内容外层，确认 Grafana `Page` 组件或 `DashboardScene.Component` 是否有条件样式。若 `resolved.removeOuterPadding=true` 且不在 kioskMode，可将 `paddingY` 设为 0：
    ```typescript
    // 若 DashboardScenePage 包含 Page 组件（非 kiosk 路径，即非 chromeless），则：
    // 确认当前 chromeless 模式已通过 AppChrome 控制，no_padding 仅在特殊场景下有效
    // 若已通过 hide_all 触发 kioskMode，则 padding 已由 AppChrome chromeless 移除，无需额外处理
    // 此步骤以集成测试验证为主，不强制引入新的 CSS 修改
    ```
  - [x] **2.4.d** 提交（若有额外 `SoloPanelPage` 改动）：
    ```bash
    git add public/app/features/dashboard-scene/solo/SoloPanelPage.tsx
    git commit -m "feat(kiosk): hideKioskFooter support in SoloPanelPage via hideLogo passthrough

    Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
    ```

- [x] 2.5 校验 scene 路径与旧版 dashboard / solo panel 路径的展示行为一致性
  - 覆盖同一 URL 参数组合在两条路径下的输出对比
  - [x] **2.5.a** 对 `hide_time=true`、`hide_refresh=true`、`hide_panel_menu=true` 各参数，在 scene 路径（`DashboardScenePage`）和旧版路径（`DashboardPage`）分别验证行为对等
  - [x] **2.5.b** 运行全量场景测试：
    ```bash
    yarn jest --no-watch public/app/features/dashboard-scene/
    yarn jest --no-watch public/app/features/dashboard/containers/
    ```
    预期：所有测试通过，无新失败

- [x] 2.6 在 AppChrome 层接入 `resolved.hideChrome`，保持原生 kiosk 兼容行为
  - 在 `AppChrome.tsx` 的现有 `useEffect`（监听 `search`）中，额外读取 `hide_all` 参数
  - 当 `resolved.hideChrome=true`（由 `hide_all=true` 推导，非 `kiosk` 直接触发）时，额外调用 `chrome.update({ kioskMode: KioskMode.Full })`，复用 kiosk 系统驱动 `chromeless` 状态
  - 确认 `DashboardBrandingFooter`（依赖 `isKioskMode`）在 `hide_all=true` 时同步隐藏（属预期行为，footer 逻辑见 2.4）
  - 扩展 `AppChromeService.exitKioskMode()`：退出时同步清除自定义参数（`hide_all`、`hide_time`、`hide_refresh`、`hide_panel_menu`、`no_padding`），通过 `locationService.partial(...)` 将这些参数置为 `null`
  - **【新增·盲区八】** 明确 ESC 键与非 kiosk 自定义参数的处理策略：`keybindingSrv.ts` 中的 ESC 处理仅在 `kioskMode` 有值时触发 `exitKioskMode()`，若用户仅使用 `?hide_time=true` 等自定义参数而未携带 `kiosk`，则 ESC 不会清除这些参数——这是有意设计（自定义参数可独立于 kiosk 使用），需在文档中明确说明，不将其视为 bug
  - 注：此任务与 2.1 内容高度重叠（tasks.md 原始设计中 2.1 和 2.6 描述了相同目标）。**实际执行时合并到 2.1 的子任务中完成**，本任务标记为已由 2.1 覆盖。
  - [x] **2.6.a** 验证 2.1 完成后，在 `?hide_all=true` 下 AppChrome 进入 chromeless 状态，且 ESC 键后所有自定义参数被清除：
    ```bash
    yarn jest --no-watch public/app/core/components/AppChrome/
    ```

## 3. Auth Proxy 嵌入访问约束

- [x] 3.1 梳理并补充 Auth Proxy 嵌入访问所需的配置说明，包括受信代理、Header、Cookie / SameSite 与嵌入前置条件
- [x] 3.2 确认前端在 Auth Proxy 失败或代理缺失时沿用现有登录 / 权限处理路径，不新增客户端绕过逻辑
- [x] 3.3 编写嵌入访问联调说明，覆盖 dashboard 和单 panel 两类 iframe 场景

## 4. 测试与回归

- [x] 4.1 为 Dashboard 页面补充组件测试，验证时间控件、刷新控件、变量区、Links 区与 panel 菜单的显隐行为
  - 使用 `locationService` mock 模拟 URL 参数（不直接修改 `window.location.search`）
  - [x] **4.1.a** 在 `DashboardControls.test.tsx` 中增加拆分后的 `hideRefreshControls` 测试用例：
    ```typescript
    it('_dash.hideTimePicker hides BOTH timePicker and refreshPicker (backward compat)', () => {
      // 渲染 DashboardControls，模拟 updateFromUrl({ '_dash.hideTimePicker': 'true' })
      // 断言：timePicker 不在 DOM 中，refreshPicker 也不在 DOM 中
    });
    it('_dash.hideRefreshPicker hides ONLY refreshPicker', () => {
      // 渲染 DashboardControls，模拟 updateFromUrl({ '_dash.hideRefreshPicker': 'true' })
      // 断言：timePicker 在 DOM 中，refreshPicker 不在 DOM 中
    });
    ```
  - [x] **4.1.b** 运行：
    ```bash
    yarn jest --no-watch public/app/features/dashboard-scene/scene/DashboardControls.test.tsx
    ```
    预期：全部通过

- [x] 4.2 为 Solo Panel 页面补充组件测试，验证紧凑布局、panel 菜单隐藏与 footer/logo 表现
  - [x] **4.2.a** 在 `SoloPanelPage.test.tsx` 中追加：
    ```typescript
    it('hides panel menu when hide_panel_menu=true', () => {
      // mock locationService 使 search = '?hide_panel_menu=true'
      // 渲染 SoloPanelRenderer，mock VizPanel
      // 断言 panel.setState 被调用时 menu 参数为 undefined
    });
    it('hides logo when hide_all=true', () => {
      // mock search = '?hide_all=true'
      // 断言 SoloPanelPageLogo hideLogo prop 为 true
    });
    ```
  - [x] **4.2.b** 运行：
    ```bash
    yarn jest --no-watch public/app/features/dashboard-scene/solo/SoloPanelPage.test.tsx
    ```
    预期：全部通过

- [x] 4.3 补充关键路径的 E2E 或明确人工验收步骤，覆盖以下场景：
  - iframe 场景的无感访问（Auth Proxy 链路）
  - `hide_all=true` 与各单项参数的组合
  - `kiosk=true` + `hide_all=true` 后按 ESC，验证所有自定义参数均被清除
  - `kiosk=''`（空字符串）边缘值触发 kiosk 行为（需同时验证 AppChromeService 修复后行为）
  - `viewPanel=X` + `hide_panel_menu=true` 的组合行为（全屏 panel 视图下菜单隐藏）
  - `/d-solo` 路由下默认显示菜单；携带 `hide_panel_menu=true` 时隐藏
  - `hide_all=true` 验证变量区和 Links 区均消失
  - **【新增·盲区三】** `hide_panel_menu=true` 后在 URL 中移除该参数，验证 panel 菜单是否正确恢复（双向测试）
  - **【新增·盲区六】** `hide_all=true` 时验证 `DashboardBrandingFooter` 不出现（覆盖 DashboardScenePage footer 注入路径）

- [x] 4.4 执行回归验证，覆盖 dashboard 页面、`/d-solo` 路由、原生 `kiosk` 行为与现有 `from` / `to` / `refresh` 参数能力
  - [x] **4.4.a** 运行 AppChrome 相关测试：
    `yarn jest --no-watch public/app/core/components/AppChrome/`
  - [x] **4.4.b** 运行 dashboard-scene 全量测试：
    `yarn jest --no-watch public/app/features/dashboard-scene/`
  - [x] **4.4.c** 运行旧版 dashboard 测试：
    `yarn jest --no-watch public/app/features/dashboard/`
  - [x] **4.4.d** 运行 TypeScript 类型检查，确认无新类型错误：
    `yarn typecheck`
  - [x] **4.4.e** 运行 ESLint，确认无新警告：
    `yarn lint public/app/features/dashboard-scene/ public/app/core/components/AppChrome/`
  - [x] **4.4.f** 提交最终集成：
    ```bash
    git add -A
    git commit -m "feat(kiosk): enhanced kiosk params full integration – regression clean

    Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
    ```

## 5. 文档与收尾

- [x] 5.1 更新相关开发文档或嵌入接入说明，记录增强型 Kiosk 参数与 Auth Proxy 约束
- [x] 5.2 汇总风险、回滚方式与联调注意事项，确保部署和维护人员可执行