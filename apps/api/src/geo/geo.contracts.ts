import { FacilityStatus, FacilityType } from '@peytakilid/shared-types';

/** Private street-level fields must never appear on public listing payloads. */
export const GEO_PUBLIC_FORBIDDEN_KEYS = [
  'line1',
  'line2',
  'postalCode',
  'latitude',
  'longitude',
  'accuracyM',
  'addressId',
  'geoPointId',
] as const;

export type PublicFacilityLocationDto = {
  id: string;
  type: FacilityType | string;
  city: string;
  province: string | null;
  region: string | null;
  countryCode: string;
};

export type SellerFacilityDto = PublicFacilityLocationDto & {
  name: string;
  status: FacilityStatus | string;
  isPublicLocation: boolean;
  address: {
    countryCode: string;
    region: string | null;
    province: string | null;
    city: string;
    line1: string;
    line2: string | null;
    postalCode: string | null;
  };
  geoPoint: { latitude: number; longitude: number; accuracyM: number | null } | null;
};

export function assertValidLatitude(lat: number) {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new Error('latitude must be between -90 and 90');
  }
}

export function assertValidLongitude(lng: number) {
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw new Error('longitude must be between -180 and 180');
  }
}

export function assertValidCountryCode(code: string) {
  if (!/^[A-Z]{2}$/.test(code)) {
    throw new Error('countryCode must be ISO-3166-1 alpha-2');
  }
}

/** Haversine distance in km — provider-independent. */
export function haversineDistanceKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function matchesRegionFilter(
  target: {
    countryCode?: string | null;
    region?: string | null;
    province?: string | null;
    city?: string | null;
  },
  filter: {
    countryCode?: string;
    region?: string;
    province?: string;
    city?: string;
  },
): boolean {
  const eq = (a?: string | null, b?: string) =>
    !b || (a || '').toLowerCase() === b.toLowerCase();
  return (
    eq(target.countryCode, filter.countryCode) &&
    eq(target.region, filter.region) &&
    eq(target.province, filter.province) &&
    eq(target.city, filter.city)
  );
}

export function isWithinRadiusKm(
  center: { latitude: number; longitude: number },
  point: { latitude: number; longitude: number },
  radiusKm: number,
): boolean {
  return haversineDistanceKm(center, point) <= radiusKm;
}

export function toPublicFacilityLocation(facility: {
  id: string;
  type: string;
  isPublicLocation: boolean;
  address: {
    countryCode: string;
    region: string | null;
    province: string | null;
    city: string;
  };
} | null): PublicFacilityLocationDto | null {
  if (!facility || !facility.isPublicLocation) return null;
  return {
    id: facility.id,
    type: facility.type,
    city: facility.address.city,
    province: facility.address.province,
    region: facility.address.region,
    countryCode: facility.address.countryCode,
  };
}

export function toSellerFacility(facility: {
  id: string;
  name: string;
  type: string;
  status: string;
  isPublicLocation: boolean;
  address: {
    countryCode: string;
    region: string | null;
    province: string | null;
    city: string;
    line1: string;
    line2: string | null;
    postalCode: string | null;
  };
  geoPoint: {
    latitude: unknown;
    longitude: unknown;
    accuracyM: unknown;
  } | null;
} | null): SellerFacilityDto | null {
  if (!facility) return null;
  return {
    id: facility.id,
    name: facility.name,
    type: facility.type,
    status: facility.status,
    isPublicLocation: facility.isPublicLocation,
    city: facility.address.city,
    province: facility.address.province,
    region: facility.address.region,
    countryCode: facility.address.countryCode,
    address: facility.address,
    geoPoint: facility.geoPoint
      ? {
          latitude: Number(facility.geoPoint.latitude),
          longitude: Number(facility.geoPoint.longitude),
          accuracyM:
            facility.geoPoint.accuracyM == null
              ? null
              : Number(facility.geoPoint.accuracyM),
        }
      : null,
  };
}
