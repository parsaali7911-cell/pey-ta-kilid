import { Injectable } from '@nestjs/common';
import {
  HomepageNaturalLanguageRequest,
  HomepageNaturalLanguageResponse,
  IntentResult,
  ProfessionalLeadDraft,
  PromptJourney,
  RequestIntent,
  RfqDraftFromRequirements,
} from '@peytakilid/shared-types';
import { requirementsToSearchQuery } from '../search/search-query.adapter';
import {
  buildClarificationPrompt,
  parseNaturalLanguageRules,
} from './intent-rule.parser';

/**
 * Deterministic intent path only.
 * Any free-form homepage prompt becomes an action (search / onboard / find pro).
 * Does not invent price, stock, seller, or availability.
 */
@Injectable()
export class IntentService {
  parseHomepageRequest(
    input: HomepageNaturalLanguageRequest,
  ): HomepageNaturalLanguageResponse {
    const text = (input.text ?? '').trim();
    const requirements = parseNaturalLanguageRules({
      text,
      locale: input.locale ?? null,
      market: input.market ?? null,
      imageAssetId: input.imageAssetId ?? null,
    });

    // Soft clarification only — never blocks free-form search on the homepage hub.
    const clarification = buildClarificationPrompt(requirements);
    const intentResult: IntentResult = {
      intent: requirements.intent,
      confidence: requirements.confidence,
      requirements,
      clarification,
    };

    const route = {
      categorySlug: requirements.categorySlugHints?.[0] ?? null,
      specialty: requirements.specialtyHints?.[0] ?? null,
      city: requirements.location?.city ?? null,
      province: requirements.location?.province ?? null,
    };

    const journey = requirements.journey || PromptJourney.UNKNOWN;

    if (journey === PromptJourney.SELL_PRODUCT) {
      return {
        intent: intentResult,
        next: 'seller_onboard',
        searchQuery: null,
        rfqDraft: null,
        professionalLead: null,
        route,
      };
    }

    if (journey === PromptJourney.REGISTER_PROFESSIONAL) {
      return {
        intent: intentResult,
        next: 'professional_onboard',
        searchQuery: null,
        rfqDraft: null,
        professionalLead: {
          requirements,
          specialtyHints: requirements.specialtyHints,
          location: requirements.location ?? null,
          status: 'draft_contract',
        },
        route,
      };
    }

    if (journey === PromptJourney.FIND_PROFESSIONAL) {
      return {
        intent: intentResult,
        next: 'professional_search',
        searchQuery: null,
        rfqDraft: null,
        professionalLead: {
          requirements,
          specialtyHints: requirements.specialtyHints,
          location: requirements.location ?? null,
          status: 'draft_contract',
        },
        route,
      };
    }

    if (requirements.intent === RequestIntent.DESIGN_ASSIST) {
      return {
        intent: intentResult,
        next: 'design_assist',
        searchQuery: requirementsToSearchQuery(requirements),
        rfqDraft: null,
        professionalLead: null,
        route,
      };
    }

    if (requirements.intent === RequestIntent.PROFESSIONAL) {
      const professionalLead: ProfessionalLeadDraft = {
        requirements,
        specialtyHints: requirements.specialtyHints,
        location: requirements.location ?? null,
        status: 'draft_contract',
      };
      return {
        intent: intentResult,
        next: 'professional_lead',
        searchQuery: null,
        rfqDraft: null,
        professionalLead,
        route,
      };
    }

    // Default for any free-form prompt: run catalog search with extracted filters.
    const searchQuery = requirementsToSearchQuery(requirements);
    const rfqDraft: RfqDraftFromRequirements = {
      requirements,
      suggestedListingIds: [...requirements.listingIdHints],
      buyerNotes: null,
      status: 'draft_contract',
    };

    if (!text) {
      return {
        intent: intentResult,
        next: 'clarify',
        searchQuery: null,
        rfqDraft: null,
        professionalLead: null,
        route,
      };
    }

    return {
      intent: intentResult,
      next: 'search',
      searchQuery,
      rfqDraft,
      professionalLead: null,
      route,
    };
  }
}
