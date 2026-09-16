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
 * Does not call AiGateway / LLMs. Never invents price, stock, seller, or availability.
 */
@Injectable()
export class IntentService {
  parseHomepageRequest(
    input: HomepageNaturalLanguageRequest,
  ): HomepageNaturalLanguageResponse {
    const requirements = parseNaturalLanguageRules({
      text: input.text,
      locale: input.locale ?? null,
      market: input.market ?? null,
      imageAssetId: input.imageAssetId ?? null,
    });

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

    if (clarification && clarification.fields.length > 0) {
      return {
        intent: intentResult,
        next: 'clarify',
        searchQuery: null,
        rfqDraft: null,
        professionalLead: null,
        route,
      };
    }

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

    const searchQuery = requirementsToSearchQuery(requirements);
    const rfqDraft: RfqDraftFromRequirements | null =
      requirements.intent === RequestIntent.PRODUCT
        ? {
            requirements,
            suggestedListingIds: [...requirements.listingIdHints],
            buyerNotes: null,
            status: 'draft_contract',
          }
        : null;

    return {
      intent: intentResult,
      next: rfqDraft ? 'search' : 'clarify',
      searchQuery,
      rfqDraft,
      professionalLead: null,
      route,
    };
  }
}
