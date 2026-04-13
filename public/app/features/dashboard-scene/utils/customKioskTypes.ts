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
