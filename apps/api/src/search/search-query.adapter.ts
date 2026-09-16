import {
  SearchFilters,
  SearchQuery,
  StructuredRequirements,
} from '@peytakilid/shared-types';
import { SOFT_ATTRIBUTE_KEYS } from '../intent/intent-rule.parser';

/**
 * Adapter: StructuredRequirements → SearchQuery.
 * Lives in Search (not Intent/RFQ). Vision can later fill filters.visionAttributeHints.
 */
export function requirementsToSearchQuery(
  requirements: StructuredRequirements,
  opts?: { limit?: number; offset?: number; filters?: SearchFilters },
): SearchQuery {
  const filters = mergeFiltersFromRequirements(requirements, opts?.filters);
  return {
    requirements,
    filters,
    limit: opts?.limit ?? 20,
    offset: opts?.offset ?? 0,
  };
}

export function mergeFiltersFromRequirements(
  requirements: StructuredRequirements,
  overrides?: SearchFilters,
): SearchFilters {
  const vision = overrides?.visionAttributeHints ?? {};
  const mergedAttrs = {
    ...requirements.attributeFilters,
    ...vision,
    ...(overrides?.attributeFilters ?? {}),
  };

  const hardAttrs: Record<string, string | number | boolean | string[]> = {};
  const softBits: string[] = [];
  for (const [key, value] of Object.entries(mergedAttrs)) {
    if (value == null || value === '') continue;
    if (SOFT_ATTRIBUTE_KEYS.has(key)) {
      softBits.push(String(value));
      continue;
    }
    hardAttrs[key] = value;
  }

  // Buyer city is a delivery/project destination — boost via text, do not hard-exclude
  // listings whose public facility city differs (common for nationwide catalogs).
  const city = requirements.location?.city;
  const textParts = [
    overrides?.text ?? null,
    requirements.rawText ?? null,
    city ? String(city) : null,
    ...softBits,
  ].filter(Boolean) as string[];

  return {
    categoryHints: overrides?.categoryHints ?? requirements.categoryHints,
    categoryIds: overrides?.categoryIds,
    attributeFilters: hardAttrs,
    visionAttributeHints: overrides?.visionAttributeHints,
    priceMin: overrides?.priceMin ?? requirements.budget?.min ?? null,
    priceMax: overrides?.priceMax ?? requirements.budget?.max ?? null,
    currency: overrides?.currency ?? requirements.budget?.currency ?? null,
    uomCode: overrides?.uomCode ?? requirements.uomCode ?? null,
    quantity: overrides?.quantity ?? requirements.quantity ?? null,
    requireAvailable: overrides?.requireAvailable ?? true,
    requireQuantityAvailable: overrides?.requireQuantityAvailable ?? false,
    requireMoqFit: overrides?.requireMoqFit ?? Boolean(requirements.quantity != null),
    maxLeadTimeDays: overrides?.maxLeadTimeDays ?? null,
    market: overrides?.market ?? requirements.market ?? null,
    locale: overrides?.locale ?? requirements.locale ?? null,
    location: overrides?.location ?? null,
    facilityProximity:
      overrides?.facilityProximity ?? requirements.facilityProximity ?? null,
    listingIds: overrides?.listingIds ?? requirements.listingIdHints,
    text: textParts.length ? textParts.join(' ') : null,
  };
}

/** Normalize incoming API body into a full SearchQuery. */
export function normalizeSearchQuery(input: SearchQuery): SearchQuery {
  const filters = mergeFiltersFromRequirements(
    input.requirements,
    input.filters,
  );
  return {
    requirements: input.requirements,
    filters,
    limit: Math.min(Math.max(input.limit ?? 20, 1), 100),
    offset: Math.max(input.offset ?? 0, 0),
  };
}
