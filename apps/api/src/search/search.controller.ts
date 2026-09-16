import { Body, Controller, Post, Query } from '@nestjs/common';
import { RequestIntent, SearchQuery, StructuredRequirements } from '@peytakilid/shared-types';
import { SearchRequestDto } from './dto/search-request.dto';
import { SearchService } from './search.service';

/**
 * Public read-only catalog search.
 * Locale/market aware; no seller/admin mutations; no LLM.
 */
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Post()
  async execute(
    @Body() body: SearchRequestDto,
    @Query('locale') localeQuery?: string,
    @Query('market') marketQuery?: string,
  ) {
    const requirements = toRequirements(body.requirements, localeQuery, marketQuery);
    const query: SearchQuery = {
      requirements,
      filters: body.filters as SearchQuery['filters'],
      limit: body.limit,
      offset: body.offset,
    };
    return this.searchService.search(query);
  }
}

function toRequirements(
  dto: SearchRequestDto['requirements'],
  localeQuery?: string,
  marketQuery?: string,
): StructuredRequirements {
  return {
    intent: (dto.intent as RequestIntent) || RequestIntent.PRODUCT,
    market: marketQuery ?? dto.market ?? null,
    locale: localeQuery ?? dto.locale ?? null,
    quantity: dto.quantity ?? null,
    uomCode: dto.uomCode ?? null,
    categoryHints: dto.categoryHints ?? [],
    attributeFilters: dto.attributeFilters ?? {},
    budget: dto.budget ?? null,
    location: (dto.location as StructuredRequirements['location']) ?? null,
    facilityProximity:
      (dto.facilityProximity as StructuredRequirements['facilityProximity']) ?? null,
    listingIdHints: dto.listingIdHints ?? [],
    specialtyHints: dto.specialtyHints ?? [],
    confidence: dto.confidence ?? 1,
    missingFields: dto.missingFields ?? [],
    rawText: dto.rawText ?? null,
  };
}
