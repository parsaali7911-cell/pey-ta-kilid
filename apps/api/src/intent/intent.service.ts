import { Injectable, Optional } from '@nestjs/common';
import {
  HomepageNaturalLanguageRequest,
  HomepageNaturalLanguageResponse,
  IntentResult,
  ProfessionalLeadDraft,
  PromptJourney,
  RequestIntent,
  RfqDraftFromRequirements,
} from '@peytakilid/shared-types';
import { AiGatewayService } from '../ai/ai-gateway.service';
import { requirementsToSearchQuery } from '../search/search-query.adapter';
import { enrichRequirementsWithAi } from './intent-ai.enricher';
import {
  buildClarificationPrompt,
  parseNaturalLanguageRules,
} from './intent-rule.parser';

/**
 * Homepage NL brain: deterministic rules first, optional OpenAI enrichment.
 * Does not invent price, stock, seller, or availability.
 */
@Injectable()
export class IntentService {
  constructor(@Optional() private readonly ai?: AiGatewayService) {}

  /** Sync rule path — used by unit tests and as AI fallback. */
  parseHomepageRequest(
    input: HomepageNaturalLanguageRequest,
  ): HomepageNaturalLanguageResponse {
    const requirements = parseNaturalLanguageRules({
      text: input.text ?? '',
      locale: input.locale ?? null,
      market: input.market ?? null,
      imageAssetId: input.imageAssetId ?? null,
    });
    return this.toResponse(requirements, (input.text ?? '').trim());
  }

  /** Production path: rules + optional AI correction when configured. */
  async parseHomepageRequestAsync(
    input: HomepageNaturalLanguageRequest,
  ): Promise<HomepageNaturalLanguageResponse> {
    let requirements = parseNaturalLanguageRules({
      text: input.text ?? '',
      locale: input.locale ?? null,
      market: input.market ?? null,
      imageAssetId: input.imageAssetId ?? null,
    });

    if (this.ai && this.ai.getProviderName() !== 'none') {
      requirements = await enrichRequirementsWithAi(this.ai, requirements);
    }

    return this.toResponse(requirements, (input.text ?? '').trim());
  }

  private toResponse(
    requirements: ReturnType<typeof parseNaturalLanguageRules>,
    text: string,
  ): HomepageNaturalLanguageResponse {
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
