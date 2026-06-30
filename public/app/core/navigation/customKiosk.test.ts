import { computeCustomKioskState, isKioskEnabled, isParamEnabled } from './customKiosk';

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
  it('returns false for empty string (from ?kiosk=)', () => expect(isKioskEnabled('')).toBe(false));
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
    expect(s.resolved.hideTime).toBe(false);
  });
  it('kiosk=true (boolean from ?kiosk no-value)', () => {
    const s = computeCustomKioskState('/d/x', '?kiosk');
    expect(s.resolved.hideChrome).toBe(true);
  });
  it('kiosk empty string does NOT trigger kiosk (?kiosk= with explicit empty value)', () => {
    const s = computeCustomKioskState('/d/x', '?kiosk=');
    expect(s.resolved.hideChrome).toBe(false);
  });
  it('kiosk=true string IS parsed to boolean true by parseKeyValue, so it triggers kiosk', () => {
    // Grafana's parseKeyValue converts string 'true' → boolean true
    const s = computeCustomKioskState('/d/x', '?kiosk=true');
    expect(s.resolved.hideChrome).toBe(true);
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
  it('hide_time=garbage → truthy (non-false/0 strings are enabled)', () => {
    const s = computeCustomKioskState('/d/x', '?hide_time=garbage');
    expect(s.resolved.hideTime).toBe(true);
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

describe('computeCustomKioskState – no params → all defaults off', () => {
  const s = computeCustomKioskState('/d/test/slug', '');
  it('hideChrome false', () => expect(s.resolved.hideChrome).toBe(false));
  it('hideTime false', () => expect(s.resolved.hideTime).toBe(false));
  it('hideRefresh false', () => expect(s.resolved.hideRefresh).toBe(false));
  it('hidePanelMenu false', () => expect(s.resolved.hidePanelMenu).toBe(false));
  it('hideVariables false', () => expect(s.resolved.hideVariables).toBe(false));
  it('hideLinks false', () => expect(s.resolved.hideLinks).toBe(false));
  it('removeOuterPadding false', () => expect(s.resolved.removeOuterPadding).toBe(false));
  it('maximizePanelArea false', () => expect(s.resolved.maximizePanelArea).toBe(false));
  it('hideKioskFooter false', () => expect(s.resolved.hideKioskFooter).toBe(false));
});
