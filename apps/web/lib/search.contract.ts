/**
 * Homepage / assistant search contract.
 * Client posts SearchQuery to POST /api/search.
 */
export type {
  RankedRecommendation,
  SearchFilters,
  SearchHit,
  SearchQuery,
} from '@peytakilid/shared-types';

export const SEARCH_ENDPOINT = '/search' as const;
