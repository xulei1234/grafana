import { useObservable } from 'react-use';

import { UrlQueryValue } from '@grafana/data';
import { locationSearchToObject, locationService } from '@grafana/runtime';

export const CUSTOM_KIOSK_PARAMS = {
  hideAll: 'hide_all',
  hideTime: 'hide_time',
  hideRefresh: 'hide_refresh',
  hidePanelMenu: 'hide_panel_menu',
  noPadding: 'no_padding',
} as const;

export const CUSTOM_KIOSK_PARAM_LIST = Object.values(CUSTOM_KIOSK_PARAMS);

export interface CustomKioskRaw {
  kiosk: UrlQueryValue;
  hideAll: UrlQueryValue;
  hideTime: UrlQueryValue;
  hideRefresh: UrlQueryValue;
  hidePanelMenu: UrlQueryValue;
  noPadding: UrlQueryValue;
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

/**
 * Check whether a URL parameter value should be treated as "enabled".
 * `undefined`, `false`, `'false'`, `'0'` → disabled; everything else → enabled.
 * Non-string/boolean URL values (arrays, numbers) are treated as disabled.
 */
export function isParamEnabled(value: UrlQueryValue): boolean {
  if (value === undefined || value === null || value === false) {
    return false;
  }
  if (value === true || value === '' || value === '1') {
    return true;
  }
  if (typeof value !== 'string') {
    return false;
  }
  const normalised = value.trim().toLowerCase();
  return normalised !== 'false' && normalised !== '0';
}

/**
 * Check whether the native kiosk parameter is enabled.
 * Only `'1'` and boolean `true` are valid kiosk-enable values.
 * `kiosk=''` (empty string from `?kiosk=`) is intentionally NOT treated as enabled —
 * only `?kiosk` (no-value, parsed as boolean true) and `?kiosk=1` activate kiosk.
 */
export function isKioskEnabled(kiosk: UrlQueryValue): boolean {
  return kiosk === '1' || kiosk === true;
}

/**
 * Pure function: compute the three-layer custom kiosk state from pathname + search string.
 * No React dependency — safe to call in useEffect or outside React.
 */
export function computeCustomKioskState(pathname: string, search: string): CustomKioskState {
  const params = locationSearchToObject(search);

  const raw: CustomKioskRaw = {
    kiosk: params['kiosk'],
    hideAll: params[CUSTOM_KIOSK_PARAMS.hideAll],
    hideTime: params[CUSTOM_KIOSK_PARAMS.hideTime],
    hideRefresh: params[CUSTOM_KIOSK_PARAMS.hideRefresh],
    hidePanelMenu: params[CUSTOM_KIOSK_PARAMS.hidePanelMenu],
    noPadding: params[CUSTOM_KIOSK_PARAMS.noPadding],
  };

  const hideAll = isParamEnabled(raw.hideAll);
  const kioskOn = isKioskEnabled(raw.kiosk);

  const context: CustomKioskContext = {
    isDashboardPage: pathname.startsWith('/d/'),
    isSoloPanelPage: pathname.startsWith('/d-solo/'),
    isViewPanelFullscreen: params['viewPanel'] != null,
  };

  const resolved: CustomKioskResolved = {
    hideChrome: hideAll || kioskOn,
    hideTime: hideAll || isParamEnabled(raw.hideTime),
    hideRefresh: hideAll || isParamEnabled(raw.hideRefresh),
    hidePanelMenu: hideAll || isParamEnabled(raw.hidePanelMenu),
    hideVariables: hideAll,
    hideLinks: hideAll,
    // Consumed by DashboardSceneRenderer → DashboardEditPaneSplitter (noPadding prop)
    removeOuterPadding: hideAll || isParamEnabled(raw.noPadding),
    // /d-solo layout is already position:fixed full-screen (SoloPanelPage.tsx), so this
    // field is informational only — the "maximize" effect is provided by existing CSS.
    maximizePanelArea: context.isSoloPanelPage || context.isViewPanelFullscreen,
    hideKioskFooter: hideAll || kioskOn,
  };

  return { raw, context, resolved };
}

/**
 * React hook: subscribe to location changes and return the current custom kiosk state.
 * Uses locationService observable for reactivity — never reads window.location directly.
 */
export function useCustomKiosk(): CustomKioskState {
  const location = useObservable(locationService.getLocationObservable(), locationService.getLocation());
  return computeCustomKioskState(location.pathname, location.search);
}
