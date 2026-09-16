import {
  BUILDING_CATEGORIES,
  BUILDING_SPECIALTIES,
  IRAN_CITIES,
  IRAN_PROVINCE_BY_CODE,
  IRAN_PROVINCES,
  type IranCity,
} from '@peytakilid/shared-types';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Build a matcher that tolerates ZWNJ / spaces between Persian compound words. */
function termToPattern(term: string): RegExp {
  const trimmed = term.trim();
  if (!trimmed) return /$a/; // never matches
  // Latin / digit tokens → word boundary
  if (/^[a-z0-9][a-z0-9\s'-]*$/i.test(trimmed)) {
    const parts = trimmed.split(/\s+/).map(escapeRegExp).join('\\s+');
    return new RegExp(`\\b${parts}\\b`, 'i');
  }
  // Persian / mixed: allow optional ZWNJ or spaces between characters of multi-word terms
  const spaced = trimmed
    .split(/[\s\u200c]+/)
    .filter(Boolean)
    .map(escapeRegExp)
    .join('[\\s\\u200c]*');
  return new RegExp(spaced, 'i');
}

export type LocationHit = {
  city: string;
  province: string | null;
  countryCode: string;
  patterns: RegExp[];
};

export type LexiconEntry = { hint: string; patterns: RegExp[] };

function cityAliases(city: IranCity): string[] {
  return [city.nameFa, city.nameEn, ...(city.aliases || [])].filter(Boolean);
}

/** Longer aliases first so کرمانشاه wins over کرمان, بندرعباس over عباس, etc. */
export function buildIranCityMatchers(): LocationHit[] {
  const hits: LocationHit[] = IRAN_CITIES.map((city) => {
    const province = IRAN_PROVINCE_BY_CODE[city.provinceCode];
    const aliases = cityAliases(city).sort((a, b) => b.length - a.length);
    return {
      city: city.nameEn,
      province: province?.nameEn ?? null,
      countryCode: city.provinceCode === 'AE' ? 'AE' : 'IR',
      patterns: aliases.map(termToPattern),
    };
  });
  hits.sort((a, b) => {
    const aMax = Math.max(...a.patterns.map((p) => p.source.length));
    const bMax = Math.max(...b.patterns.map((p) => p.source.length));
    return bMax - aMax;
  });
  return hits;
}

export function buildIranProvinceMatchers(): Array<{
  province: string;
  countryCode: string;
  patterns: RegExp[];
}> {
  return IRAN_PROVINCES.map((p) => {
    const aliases = [p.nameFa, p.nameEn, ...(p.aliases || [])].sort(
      (a, b) => b.length - a.length,
    );
    return {
      province: p.nameEn,
      countryCode: 'IR',
      patterns: aliases.map(termToPattern),
    };
  }).sort((a, b) => {
    const aMax = Math.max(...a.patterns.map((p) => p.source.length));
    const bMax = Math.max(...b.patterns.map((p) => p.source.length));
    return bMax - aMax;
  });
}

export function buildCategoryLexicon(): {
  lexicon: LexiconEntry[];
  slugByHint: Record<string, string>;
  productHintTerms: string[];
} {
  const lexicon: LexiconEntry[] = BUILDING_CATEGORIES.map((c) => ({
    hint: c.hint,
    patterns: c.terms.map(termToPattern),
  }));
  // Avoid matching bare «گچ» inside «گچ کار»
  const gypsum = lexicon.find((e) => e.hint === 'gypsum');
  if (gypsum) {
    gypsum.patterns = [
      /\bgypsum\b/i,
      /\bplaster\b/i,
      /گچ(?![\s\u200c]*کار)/,
      /اندود/,
      /گچ[\s\u200c]*برگ/,
      /کناف(?![\s\u200c]*کار)/,
    ];
  }
  const slugByHint = Object.fromEntries(BUILDING_CATEGORIES.map((c) => [c.hint, c.slug]));
  const productHintTerms = BUILDING_CATEGORIES.flatMap((c) => c.terms.map((t) => t.toLowerCase()));
  return { lexicon, slugByHint, productHintTerms };
}

export function buildSpecialtyLexicon(): {
  lexicon: LexiconEntry[];
  professionalHintTerms: string[];
  specialtyOptions: Array<{ code: string; nameEn: string; nameFa: string }>;
} {
  const lexicon: LexiconEntry[] = BUILDING_SPECIALTIES.map((s) => ({
    hint: s.code,
    patterns: s.terms.map(termToPattern),
  }));
  const professionalHintTerms = BUILDING_SPECIALTIES.flatMap((s) =>
    s.terms.map((t) => t.toLowerCase()),
  );
  const specialtyOptions = BUILDING_SPECIALTIES.map((s) => ({
    code: s.code,
    nameEn: s.nameEn,
    nameFa: s.nameFa,
  }));
  return { lexicon, professionalHintTerms, specialtyOptions };
}

export const IRAN_CITY_MATCHERS = buildIranCityMatchers();
export const IRAN_PROVINCE_MATCHERS = buildIranProvinceMatchers();
export const CATEGORY_LEXICON_BUILT = buildCategoryLexicon();
export const SPECIALTY_LEXICON_BUILT = buildSpecialtyLexicon();
