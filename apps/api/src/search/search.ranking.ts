import {
  DEFAULT_SEARCH_RANKING_WEIGHTS,
  SearchFilters,
  SearchRankingWeights,
  SearchScoreComponent,
} from '@peytakilid/shared-types';
import { matchesRegionFilter } from '../geo/geo.contracts';

export type RankableListing = {
  id: string;
  title: string;
  description: string | null;
  slug: string;
  uomCode: string;
  moq: number | null;
  leadTimeDays: number | null;
  category: {
    id: string;
    slug: string;
    nameEn: string;
    nameFa: string | null;
    nameAr: string | null;
  };
  attributes: Array<{
    code: string;
    valueString: string | null;
    valueNumber: number | null;
    valueBoolean: boolean | null;
  }>;
  displayPrice: number | null;
  currency: string | null;
  available: number | null;
  facilityPublic: {
    id?: string;
    city: string;
    province?: string | null;
    countryCode: string;
  } | null;
};

export type RankResult = {
  score: number;
  matchedAttributes: string[];
  scoreComponents: SearchScoreComponent[];
  excluded: boolean;
  excludeReason?: string;
};

/**
 * Deterministic ranking — never invents price/stock/geo.
 * Missing listing values score 0 for that component (no fabrication).
 */
export function rankListing(
  listing: RankableListing,
  filters: SearchFilters,
  weights: SearchRankingWeights = DEFAULT_SEARCH_RANKING_WEIGHTS,
): RankResult {
  const components: SearchScoreComponent[] = [];
  const matchedAttributes: string[] = [];

  // Hard filters first
  if (filters.uomCode && listing.uomCode !== filters.uomCode) {
    return excluded('uom_mismatch');
  }
  if (filters.currency && listing.currency && listing.currency !== filters.currency) {
    return excluded('currency_mismatch');
  }
  if (filters.currency && listing.displayPrice == null) {
    return excluded('missing_price_for_currency_filter');
  }
  if (filters.priceMin != null && listing.displayPrice != null) {
    if (listing.displayPrice < filters.priceMin) return excluded('below_price_min');
  }
  if (filters.priceMax != null && listing.displayPrice != null) {
    if (listing.displayPrice > filters.priceMax) return excluded('above_price_max');
  }
  if (filters.requireAvailable && (listing.available == null || listing.available <= 0)) {
    return excluded('unavailable');
  }
  if (
    filters.requireQuantityAvailable &&
    filters.quantity != null &&
    (listing.available == null || listing.available < filters.quantity)
  ) {
    return excluded('insufficient_available');
  }
  if (
    filters.requireMoqFit &&
    filters.quantity != null &&
    listing.moq != null &&
    listing.moq > filters.quantity
  ) {
    return excluded('moq_exceeds_quantity');
  }
  if (
    filters.maxLeadTimeDays != null &&
    listing.leadTimeDays != null &&
    listing.leadTimeDays > filters.maxLeadTimeDays
  ) {
    return excluded('lead_time_exceeded');
  }

  const attrFilters = {
    ...(filters.attributeFilters ?? {}),
    ...(filters.visionAttributeHints ?? {}),
  };
  for (const [code, wanted] of Object.entries(attrFilters)) {
    const attr = listing.attributes.find((a) => a.code === code);
    if (!attr || !attributeMatches(attr, wanted)) {
      return excluded(`attribute_mismatch:${code}`);
    }
    matchedAttributes.push(code);
  }

  if (filters.location && listing.facilityPublic) {
    if (
      !matchesRegionFilter(listing.facilityPublic, {
        countryCode: filters.location.countryCode ?? undefined,
        region: filters.location.region ?? undefined,
        province: filters.location.province ?? undefined,
        city: filters.location.city ?? undefined,
      })
    ) {
      return excluded('location_mismatch');
    }
  } else if (filters.location?.city && !listing.facilityPublic) {
    return excluded('location_required_no_public_facility');
  }

  if (filters.facilityProximity?.nearFacilityId) {
    if (listing.facilityPublic?.id !== filters.facilityProximity.nearFacilityId) {
      // Soft: no hard drop without radius/geo — proximity scoring only when IDs match
      // Hard filter only when prefer exact facility id without radius
      if (!filters.facilityProximity.radiusKm) {
        return excluded('facility_id_mismatch');
      }
    }
  }

  // Soft score components
  const text = (filters.text || '').trim().toLowerCase();
  if (text) {
    const hay = `${listing.title} ${listing.description || ''} ${listing.slug}`.toLowerCase();
    const tokens = text.split(/\s+/).filter((t) => t.length > 1);
    const hits = tokens.filter((t) => hay.includes(t)).length;
    if (hits > 0) {
      const ratio = hits / Math.max(tokens.length, 1);
      components.push({
        key: 'text',
        points: round(weights.text * ratio),
        reason: `matched ${hits}/${tokens.length} text tokens`,
      });
    }
  }

  const hints = filters.categoryHints ?? [];
  if (hints.length) {
    const catBag =
      `${listing.category.slug} ${listing.category.nameEn} ${listing.category.nameFa || ''} ${listing.category.nameAr || ''}`.toLowerCase();
    const matched = hints.filter((h) => catBag.includes(h.toLowerCase()));
    if (matched.length) {
      components.push({
        key: 'category',
        points: round(weights.category * (matched.length / hints.length)),
        reason: `category hints: ${matched.join(',')}`,
      });
    }
  } else if (filters.categoryIds?.includes(listing.category.id)) {
    components.push({
      key: 'category',
      points: weights.category,
      reason: 'category id match',
    });
  }

  if (matchedAttributes.length) {
    components.push({
      key: 'attribute',
      points: weights.attribute,
      reason: `attributes: ${matchedAttributes.join(',')}`,
    });
  }

  if (listing.available != null && listing.available > 0) {
    let availPoints = weights.availability * 0.5;
    if (filters.quantity != null && listing.available >= filters.quantity) {
      availPoints = weights.availability;
    }
    components.push({
      key: 'availability',
      points: round(availPoints),
      reason: `available=${listing.available}`,
    });
  }

  if (filters.location && listing.facilityPublic) {
    components.push({
      key: 'location',
      points: weights.location,
      reason: `public facility ${listing.facilityPublic.city}`,
    });
  } else if (filters.preferredCity && listing.facilityPublic?.city) {
    const needle = filters.preferredCity.toLowerCase();
    const city = listing.facilityPublic.city.toLowerCase();
    const province = (listing.facilityPublic.province || '').toLowerCase();
    if (city.includes(needle) || needle.includes(city) || province.includes(needle)) {
      components.push({
        key: 'location',
        points: weights.location,
        reason: `preferred city match ${listing.facilityPublic.city}`,
      });
    } else {
      // Soft downrank remote facilities when buyer named a city
      components.push({
        key: 'location',
        points: round(weights.location * 0.15),
        reason: `other city ${listing.facilityPublic.city}`,
      });
    }
  }

  if (
    listing.displayPrice != null &&
    (filters.priceMin != null || filters.priceMax != null || filters.preferCheapest)
  ) {
    // Absolute budget fit gets full price weight; cheapest preference scored in search.service
    components.push({
      key: 'price',
      points:
        filters.priceMin != null || filters.priceMax != null
          ? weights.price
          : round(weights.price * 0.35),
      reason: `price ${listing.displayPrice}${filters.preferCheapest ? ' (cheapest mode)' : ''}`,
    });
  }

  if (filters.quantity != null) {
    if (listing.moq == null || listing.moq <= filters.quantity) {
      components.push({
        key: 'moq',
        points: weights.moq,
        reason: listing.moq == null ? 'no moq' : `moq ${listing.moq} <= qty`,
      });
    }
  }

  if (filters.maxLeadTimeDays != null && listing.leadTimeDays != null) {
    const fit = 1 - listing.leadTimeDays / Math.max(filters.maxLeadTimeDays, 1);
    components.push({
      key: 'leadTime',
      points: round(weights.leadTime * Math.max(0, fit)),
      reason: `leadTimeDays=${listing.leadTimeDays}`,
    });
  }

  if (filters.listingIds?.includes(listing.id)) {
    components.push({
      key: 'listingHint',
      points: weights.listingHint,
      reason: 'listing id hint',
    });
  }

  const score = round(components.reduce((s, c) => s + c.points, 0));
  return { score, matchedAttributes, scoreComponents: components, excluded: false };
}

function attributeMatches(
  attr: {
    valueString: string | null;
    valueNumber: number | null;
    valueBoolean: boolean | null;
  },
  wanted: string | number | boolean | string[],
): boolean {
  if (Array.isArray(wanted)) {
    return wanted.some((w) => attributeMatches(attr, w));
  }
  if (typeof wanted === 'boolean') {
    return attr.valueBoolean === wanted;
  }
  if (typeof wanted === 'number') {
    return attr.valueNumber != null && Number(attr.valueNumber) === wanted;
  }
  if (attr.valueString != null) {
    return attr.valueString.toLowerCase() === String(wanted).toLowerCase();
  }
  if (attr.valueNumber != null) {
    return String(attr.valueNumber) === String(wanted);
  }
  return false;
}

function excluded(reason: string): RankResult {
  return {
    score: 0,
    matchedAttributes: [],
    scoreComponents: [],
    excluded: true,
    excludeReason: reason,
  };
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}
