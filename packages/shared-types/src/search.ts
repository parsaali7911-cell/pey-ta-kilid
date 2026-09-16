import type {
  FacilityProximityRequirement,
  LocationRequirement,
  StructuredRequirements,
} from './intent';

/**
 * Explicit search filters — category-agnostic.
 * Vision may later populate attributeFilters / visionAttributeHints only (no image blob).
 */
export type SearchFilters = {
  categoryIds?: string[];
  categoryHints?: string[];
  attributeFilters?: Record<string, string | number | boolean | string[]>;
  /** Merged into attribute matching; reserved for future Vision output */
  visionAttributeHints?: Record<string, string | number | boolean | string[]>;
  priceMin?: number | null;
  priceMax?: number | null;
  currency?: string | null;
  uomCode?: string | null;
  quantity?: number | null;
  /** Soft prefer in-stock; hard-drop when true and available is 0 */
  requireAvailable?: boolean;
  /** When quantity set, require available >= quantity */
  requireQuantityAvailable?: boolean;
  /** When quantity set, require moq == null || moq <= quantity */
  requireMoqFit?: boolean;
  maxLeadTimeDays?: number | null;
  market?: string | null;
  locale?: string | null;
  location?: LocationRequirement | null;
  facilityProximity?: FacilityProximityRequirement | null;
  listingIds?: string[];
  text?: string | null;
  /** Soft prefer facility city match (buyer delivery city). */
  preferredCity?: string | null;
  /** Sort / boost toward lowest displayPrice. */
  preferCheapest?: boolean;
};

export type SearchScoreComponentKey =
  | 'text'
  | 'category'
  | 'attribute'
  | 'availability'
  | 'price'
  | 'moq'
  | 'leadTime'
  | 'location'
  | 'listingHint';

export type SearchScoreComponent = {
  key: SearchScoreComponentKey;
  points: number;
  reason: string;
};

export type SearchRankingWeights = Record<SearchScoreComponentKey, number>;

export const DEFAULT_SEARCH_RANKING_WEIGHTS: SearchRankingWeights = {
  text: 25,
  category: 20,
  attribute: 20,
  availability: 15,
  price: 25,
  moq: 5,
  leadTime: 3,
  location: 30,
  listingHint: 30,
};

/** Extended query: requirements (from Intent) + optional explicit filters. */
export type SearchQuery = {
  requirements: StructuredRequirements;
  filters?: SearchFilters;
  limit?: number;
  offset?: number;
};

export type SearchHitPreview = {
  title: string;
  slug: string;
  displayPrice?: number | null;
  currency?: string | null;
  available?: number | null;
  uomCode?: string | null;
  moq?: number | null;
  leadTimeDays?: number | null;
  category?: { id: string; slug: string; name: string } | null;
  /** Public org identity only */
  organizationPublic?: { id: string; name: string; slug: string } | null;
  facilityPublic?: {
    id?: string;
    type?: string;
    city: string;
    province?: string | null;
    countryCode: string;
  } | null;
};

export type SearchHit = {
  listingId: string;
  score: number;
  matchedAttributes: string[];
  scoreComponents: SearchScoreComponent[];
  preview: SearchHitPreview;
};

export type RankedRecommendation = {
  hits: SearchHit[];
  strategy: 'rule' | 'hybrid' | 'embedding';
  explanation?: string | null;
  totalCandidates?: number;
};
