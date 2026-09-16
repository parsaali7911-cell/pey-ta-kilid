import {
  BUILDING_SPECIALTIES,
  IRAN_CITIES,
  IRAN_CITY_COORDS,
  IRAN_PROVINCE_BY_CODE,
} from '@peytakilid/shared-types';

export type ResolvedIranPlace = {
  city: string;
  cityFa: string;
  province: string | null;
  provinceCode: string | null;
  countryCode: 'IR' | 'AE';
  latitude: number;
  longitude: number;
};

function norm(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/\u200c/g, '')
    .replace(/\s+/g, ' ');
}

/** Resolve a free-text Iranian city (FA/EN) to canonical name + coordinates. */
export function resolveIranPlace(query: string | null | undefined): ResolvedIranPlace | null {
  const q = norm(query || '');
  if (!q) return null;

  for (const city of IRAN_CITIES) {
    const aliases = [city.nameEn, city.nameFa, ...(city.aliases || [])].map(norm);
    if (!aliases.some((a) => a === q || q.includes(a) || a.includes(q))) continue;
    const coords = IRAN_CITY_COORDS[city.nameEn];
    const province = IRAN_PROVINCE_BY_CODE[city.provinceCode];
    if (!coords) continue;
    return {
      city: city.nameEn,
      cityFa: city.nameFa,
      province: province?.nameEn ?? null,
      provinceCode: city.provinceCode,
      countryCode: city.provinceCode === 'AE' ? 'AE' : 'IR',
      latitude: coords.latitude,
      longitude: coords.longitude,
    };
  }
  return null;
}

export function specialtyLabel(code: string | null | undefined, locale = 'fa') {
  const hit = BUILDING_SPECIALTIES.find((s) => s.code === code);
  if (!hit) return code || null;
  return locale === 'en' ? hit.nameEn : hit.nameFa;
}
