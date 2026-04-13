import { useObservable } from 'react-use';

import { locationSearchToObject, locationService } from '@grafana/runtime';

import {
  CUSTOM_KIOSK_PARAMS,
  CustomKioskContext,
  CustomKioskRaw,
  CustomKioskResolved,
  CustomKioskState,
} from './customKioskTypes';

/**
 * Check whether a URL parameter value should be treated as "enabled".
 * `undefined`, `false`, `'false'`, `'0'` → disabled; everything else → enabled.
 */
export function isParamEnabled(value: string | boolean | undefined): boolean {
  if (value === undefined || value === null || value === false) {
    return false;
  }
  if (value === true || value === '' || value === '1') {
    return true;
  }
  const normalised = String(value).trim().toLowerCase();
  return normalised !== 'false' && normalised !== '0';
}

/**
 * Check whether the native kiosk parameter is enabled.
 * Only `'1'`, boolean `true`, and empty string `''` are valid kiosk-enable values,
 * aligning with `DashboardScenePage.tsx` and `AppChromeService.setKioskModeFromUrl`.
 */
export function isKioskEnabled(kiosk: string | boolean | undefined): boolean {
  return kiosk === '1' || kiosk === true || kiosk === '';
}

/**
 * Pure function: compute the three-layer custom kiosk state from pathname + search string.
 * No React dependency — safe to call in useEffect or outside React.
 */
export function computeCustomKioskState(pathname: string, search: string): CustomKioskState {
  const params = locationSearchToObject(search);

  const raw: CustomKioskRaw = {
    kiosk: params['kiosk'] as string | boolean | undefined,
    hideAll: params[CUSTOM_KIOSK_PARAMS.hideAll] as string | boolean | undefined,
    hideTime: params[CUSTOM_KIOSK_PARAMS.hideTime] as string | boolean | undefined,
    hideRefresh: params[CUSTOM_KIOSK_PARAMS.hideRefresh] as string | boolean | undefined,
    hidePanelMenu: params[CUSTOM_KIOSK_PARAMS.hidePanelMenu] as string | boolean | undefined,
    noPadding: params[CUSTOM_KIOSK_PARAMS.noPadding] as string | boolean | undefined,
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
    // TODO(Phase 2): wire removeOuterPadding consumption into DashboardScenePage/SoloPanelPage layout
    removeOuterPadding: hideAll || isParamEnabled(raw.noPadding),
    // TODO(Phase 2): wire maximizePanelArea consumption into SoloPanelPage layout
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
