import { KioskMode } from 'app/types/dashboard';

import { getKioskMode } from './kiosk';

describe('getKioskMode', () => {
  it('returns KioskMode.Full for kiosk="1"', () => {
    expect(getKioskMode({ kiosk: '1' })).toBe(KioskMode.Full);
  });

  it('returns KioskMode.Full for kiosk=true (boolean, i.e. ?kiosk with no value)', () => {
    expect(getKioskMode({ kiosk: true })).toBe(KioskMode.Full);
  });

  it('returns KioskMode.Full for kiosk="" (empty string, i.e. ?kiosk=)', () => {
    expect(getKioskMode({ kiosk: '' })).toBe(KioskMode.Full);
  });

  it('returns null when kiosk is undefined', () => {
    expect(getKioskMode({})).toBeNull();
  });

  it('returns null for unrecognised kiosk values', () => {
    expect(getKioskMode({ kiosk: 'tv' })).toBeNull();
    expect(getKioskMode({ kiosk: 'false' })).toBeNull();
  });
});
