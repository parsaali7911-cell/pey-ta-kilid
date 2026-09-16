import { BadRequestException, Injectable } from '@nestjs/common';
import {
  assertValidCountryCode,
  assertValidLatitude,
  assertValidLongitude,
  haversineDistanceKm,
  isWithinRadiusKm,
  matchesRegionFilter,
} from './geo.contracts';

@Injectable()
export class GeoService {
  validateCoordinates(latitude: number, longitude: number) {
    try {
      assertValidLatitude(latitude);
      assertValidLongitude(longitude);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
  }

  validateCountryCode(code: string) {
    try {
      assertValidCountryCode(code.toUpperCase());
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
    return code.toUpperCase();
  }

  distanceKm(
    a: { latitude: number; longitude: number },
    b: { latitude: number; longitude: number },
  ) {
    this.validateCoordinates(a.latitude, a.longitude);
    this.validateCoordinates(b.latitude, b.longitude);
    return haversineDistanceKm(a, b);
  }

  nearby(
    origin: { latitude: number; longitude: number },
    points: Array<{ id: string; latitude: number; longitude: number }>,
    radiusKm: number,
  ) {
    this.validateCoordinates(origin.latitude, origin.longitude);
    return points
      .map((p) => ({
        id: p.id,
        distanceKm: haversineDistanceKm(origin, p),
      }))
      .filter((p) => p.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }

  filterByRegion = matchesRegionFilter;
  withinRadius = isWithinRadiusKm;
}
