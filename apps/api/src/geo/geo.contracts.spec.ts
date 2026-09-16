import {
  assertValidLatitude,
  assertValidLongitude,
  haversineDistanceKm,
  isWithinRadiusKm,
  matchesRegionFilter,
  toPublicFacilityLocation,
} from './geo.contracts';

describe('geo contracts', () => {
  it('validates latitude/longitude ranges', () => {
    expect(() => assertValidLatitude(91)).toThrow(/latitude/);
    expect(() => assertValidLongitude(-181)).toThrow(/longitude/);
    expect(() => assertValidLatitude(35.7)).not.toThrow();
  });

  it('computes haversine distance and radius checks', () => {
    const tehran = { latitude: 35.6892, longitude: 51.389 };
    const nearby = { latitude: 35.7, longitude: 51.4 };
    const d = haversineDistanceKm(tehran, nearby);
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThan(5);
    expect(isWithinRadiusKm(tehran, nearby, 10)).toBe(true);
    expect(isWithinRadiusKm(tehran, nearby, 0.01)).toBe(false);
  });

  it('filters by region fields', () => {
    expect(
      matchesRegionFilter(
        { countryCode: 'IR', province: 'Tehran', city: 'Tehran' },
        { countryCode: 'IR', city: 'Tehran' },
      ),
    ).toBe(true);
    expect(
      matchesRegionFilter(
        { countryCode: 'IR', city: 'Isfahan' },
        { countryCode: 'IR', city: 'Tehran' },
      ),
    ).toBe(false);
  });

  it('public facility DTO omits private address/geo', () => {
    const pub = toPublicFacilityLocation({
      id: 'f1',
      type: 'WAREHOUSE',
      isPublicLocation: true,
      address: {
        countryCode: 'IR',
        region: null,
        province: 'Tehran',
        city: 'Tehran',
      },
    });
    expect(pub).toEqual({
      id: 'f1',
      type: 'WAREHOUSE',
      city: 'Tehran',
      province: 'Tehran',
      region: null,
      countryCode: 'IR',
    });
    expect(toPublicFacilityLocation({
      id: 'f2',
      type: 'FACTORY',
      isPublicLocation: false,
      address: { countryCode: 'IR', region: null, province: null, city: 'X' },
    })).toBeNull();
  });
});
