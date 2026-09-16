import { IRAN_CITIES, IRAN_CITY_COORDS } from '@peytakilid/shared-types';
import { resolveIranPlace } from './iran-place';

describe('Iran place resolver', () => {
  it('has coordinates for every lexicon city', () => {
    const missing = IRAN_CITIES.filter((c) => !IRAN_CITY_COORDS[c.nameEn]);
    expect(missing).toEqual([]);
  });

  it('resolves FA city names to lat/lng', () => {
    const rasht = resolveIranPlace('رشت');
    expect(rasht?.city).toBe('Rasht');
    expect(rasht?.latitude).toBeGreaterThan(35);
    expect(rasht?.longitude).toBeGreaterThan(48);

    const qeshm = resolveIranPlace('قشم');
    expect(qeshm?.city).toBe('Qeshm');
    expect(qeshm?.province).toBe('Hormozgan');
  });
});
