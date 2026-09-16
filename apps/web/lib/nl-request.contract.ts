/**
 * Homepage Natural Language Request contract.
 * UI posts to POST /api/intent/nl via NeedComposer.
 */
export type {
  HomepageNaturalLanguageRequest,
  HomepageNaturalLanguageResponse,
  IntentResult,
  RequestIntent,
} from '@peytakilid/shared-types';

export const HOMEPAGE_NL_ENDPOINT = '/intent/nl' as const;
