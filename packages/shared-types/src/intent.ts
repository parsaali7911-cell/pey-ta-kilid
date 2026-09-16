import type { SearchQuery as SearchQueryContract } from './search';
import type { RfqDraftFromRequirements } from './rfq';

export enum RequestIntent {
  PRODUCT = 'PRODUCT',
  PROFESSIONAL = 'PROFESSIONAL',
  AMBIGUOUS = 'AMBIGUOUS',
  DESIGN_ASSIST = 'DESIGN_ASSIST',
}

/** Who is speaking / what journey to open from the homepage prompt. */
export enum PromptJourney {
  BUY_PRODUCT = 'BUY_PRODUCT',
  SELL_PRODUCT = 'SELL_PRODUCT',
  REGISTER_PROFESSIONAL = 'REGISTER_PROFESSIONAL',
  FIND_PROFESSIONAL = 'FIND_PROFESSIONAL',
  DESIGN_ASSIST = 'DESIGN_ASSIST',
  UNKNOWN = 'UNKNOWN',
}

export type BudgetRequirement = {
  min?: number | null;
  max?: number | null;
  /** ISO currency code — align with CurrencyCode */
  currency?: string | null;
};

export type LocationRequirement = {
  countryCode?: string | null;
  region?: string | null;
  province?: string | null;
  city?: string | null;
};

export type FacilityProximityRequirement = {
  nearFacilityId?: string | null;
  radiusKm?: number | null;
  preferPublicLocation?: boolean;
};

/** Canonical structured brief produced from NL/image before Search/RFQ. */
export type StructuredRequirements = {
  intent: RequestIntent;
  /** Homepage prompt journey (seller onboard / find pro / …). */
  journey?: PromptJourney;
  /** Taxonomy leaf slug hints for seller wizard (e.g. ceramic-tile). */
  categorySlugHints?: string[];
  /** Align with MarketCode */
  market?: string | null;
  locale?: string | null;
  quantity?: number | null;
  uomCode?: string | null;
  categoryHints: string[];
  attributeFilters: Record<string, string | number | boolean | string[]>;
  budget?: BudgetRequirement | null;
  location?: LocationRequirement | null;
  facilityProximity?: FacilityProximityRequirement | null;
  listingIdHints: string[];
  specialtyHints: string[];
  confidence: number;
  missingFields: string[];
  rawText?: string | null;
};

export type ClarificationField = {
  field: string;
  question: string;
  reason: 'blocking';
};

/** At most 1–3 blocking clarification fields. */
export type ClarificationPrompt = {
  fields: ClarificationField[];
};

export type IntentResult = {
  intent: RequestIntent;
  confidence: number;
  requirements: StructuredRequirements;
  clarification?: ClarificationPrompt | null;
};

export type {
  RankedRecommendation,
  SearchFilters,
  SearchHit,
  SearchHitPreview,
  SearchQuery,
  SearchRankingWeights,
  SearchScoreComponent,
  SearchScoreComponentKey,
} from './search';
export { DEFAULT_SEARCH_RANKING_WEIGHTS } from './search';

export type { RfqDraftFromRequirements } from './rfq';

export type ProfessionalLeadDraft = {
  requirements: StructuredRequirements;
  specialtyHints: string[];
  location: LocationRequirement | null;
  status: 'draft_contract';
};

export type HomepageNaturalLanguageRequest = {
  text: string;
  locale?: string;
  market?: string;
  imageAssetId?: string | null;
};

export type HomepageNaturalLanguageResponse = {
  intent: IntentResult;
  next:
    | 'search'
    | 'clarify'
    | 'rfq_draft'
    | 'professional_lead'
    | 'design_assist'
    | 'seller_onboard'
    | 'professional_onboard'
    | 'professional_search';
  searchQuery?: SearchQueryContract | null;
  rfqDraft?: RfqDraftFromRequirements | null;
  professionalLead?: ProfessionalLeadDraft | null;
  /** Suggested client route params for deep-link journeys. */
  route?: {
    categorySlug?: string | null;
    specialty?: string | null;
    city?: string | null;
    province?: string | null;
  } | null;
};

export const MAX_CLARIFICATION_FIELDS = 3;

export const BLOCKING_REQUIREMENT_FIELDS = [
  'intent',
  'quantity',
  'uomCode',
  'categoryHints',
  'location.city',
  'specialtyHints',
  'budget.currency',
] as const;
