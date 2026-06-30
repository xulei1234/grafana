import { locationService } from '@grafana/runtime';
import { KioskMode } from 'app/types/dashboard';

import { AppChromeService } from './AppChromeService';

// Mock locationService.partial to avoid actual navigation in unit tests
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  locationService: {
    ...jest.requireActual('@grafana/runtime').locationService,
    partial: jest.fn(),
  },
}));

describe('AppChromeService', () => {
  it('Ignore state updates when sectionNav and pageNav have new instance but same text, url or active child', () => {
    const chromeService = new AppChromeService();
    let stateChanges = 0;

    chromeService.state.subscribe(() => stateChanges++);
    chromeService.update({
      sectionNav: { node: { text: 'hello' }, main: { text: '' } },
      pageNav: { text: 'test', url: 'A' },
    });
    chromeService.update({
      sectionNav: { node: { text: 'hello' }, main: { text: '' } },
      pageNav: { text: 'test', url: 'A' },
    });

    expect(stateChanges).toBe(2);

    // if url change we should update
    chromeService.update({
      sectionNav: { node: { text: 'hello' }, main: { text: '' } },
      pageNav: { text: 'test', url: 'new/url' },
    });
    expect(stateChanges).toBe(3);

    // if active child changed should update state
    chromeService.update({
      sectionNav: { node: { text: 'hello' }, main: { text: '' } },
      pageNav: { text: 'test', url: 'A', children: [{ text: 'child', active: true }] },
    });
    expect(stateChanges).toBe(4);

    // If active child is the same we should not update state
    chromeService.update({
      sectionNav: { node: { text: 'hello' }, main: { text: '' } },
      pageNav: { text: 'test', url: 'A', children: [{ text: 'child', active: true }] },
    });
    expect(stateChanges).toBe(4);
  });

  describe('setKioskModeFromUrl', () => {
    it('sets KioskMode.Full when kiosk="1"', () => {
      const svc = new AppChromeService();
      svc.setKioskModeFromUrl('1');
      expect(svc.state.getValue().kioskMode).toBe(KioskMode.Full);
    });

    it('sets KioskMode.Full when kiosk=true (boolean, i.e. ?kiosk with no value)', () => {
      const svc = new AppChromeService();
      svc.setKioskModeFromUrl(true);
      expect(svc.state.getValue().kioskMode).toBe(KioskMode.Full);
    });

    it('does NOT set kioskMode when kiosk="" (explicit empty value, i.e. ?kiosk=, distinct from ?kiosk)', () => {
      const svc = new AppChromeService();
      svc.setKioskModeFromUrl('');
      expect(svc.state.getValue().kioskMode).toBeNull();
    });

    it('does NOT set kioskMode for unrecognised values', () => {
      const svc = new AppChromeService();
      svc.setKioskModeFromUrl('true');
      expect(svc.state.getValue().kioskMode).toBeNull();
    });
  });

  describe('exitKioskMode', () => {
    it('clears kiosk param and all custom kiosk params from URL', () => {
      const svc = new AppChromeService();
      svc.update({ kioskMode: KioskMode.Full });
      expect(svc.state.getValue().kioskMode).toBe(KioskMode.Full);

      svc.exitKioskMode();

      expect(locationService.partial).toHaveBeenCalledWith(
        expect.objectContaining({
          kiosk: null,
          hide_all: null,
          hide_time: null,
          hide_refresh: null,
          hide_panel_menu: null,
          no_padding: null,
        })
      );
      expect(svc.state.getValue().kioskMode).toBeUndefined();
    });
  });
});
