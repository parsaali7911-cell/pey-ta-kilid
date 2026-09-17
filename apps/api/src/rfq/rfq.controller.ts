import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  CreateRfqDraftFromSearchInput,
  RequestIntent,
  StructuredRequirements,
} from '@peytakilid/shared-types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateRfqDraftDto } from './dto/create-rfq.dto';
import { RfqService } from './rfq.service';

type AuthUser = { userId: string };

@Controller('buyer/rfqs')
@UseGuards(JwtAuthGuard)
export class RfqController {
  constructor(private readonly rfqs: RfqService) {}

  @Post('draft')
  createDraft(@Req() req: { user: AuthUser }, @Body() dto: CreateRfqDraftDto) {
    const input: CreateRfqDraftFromSearchInput = {
      buyerOrganizationId: dto.buyerOrganizationId,
      requirements: toRequirements(dto.requirements),
      selectedListingIds: dto.selectedListingIds ?? [],
      buyerNotes: dto.buyerNotes,
      items: dto.items,
      projectId: dto.projectId,
      projectRequirementId: dto.projectRequirementId,
    };
    return this.rfqs.createDraft(req.user.userId, input);
  }

  @Post(':id/submit')
  submit(@Req() req: { user: AuthUser }, @Param('id') id: string) {
    return this.rfqs.submit(req.user.userId, id);
  }

  @Get()
  list(
    @Req() req: { user: AuthUser },
    @Query('organizationId') organizationId: string,
  ) {
    return this.rfqs.listForBuyer(req.user.userId, organizationId);
  }

  @Get(':id')
  getOne(@Req() req: { user: AuthUser }, @Param('id') id: string) {
    return this.rfqs.getAuthorized(req.user.userId, id);
  }
}

function toRequirements(raw: Record<string, unknown>): StructuredRequirements {
  return {
    intent: (raw.intent as RequestIntent) || RequestIntent.PRODUCT,
    market: (raw.market as string) ?? null,
    locale: (raw.locale as string) ?? null,
    quantity: (raw.quantity as number) ?? null,
    uomCode: (raw.uomCode as string) ?? null,
    categoryHints: (raw.categoryHints as string[]) ?? [],
    attributeFilters:
      (raw.attributeFilters as Record<string, string | number | boolean | string[]>) ??
      {},
    budget: (raw.budget as StructuredRequirements['budget']) ?? null,
    location: (raw.location as StructuredRequirements['location']) ?? null,
    facilityProximity:
      (raw.facilityProximity as StructuredRequirements['facilityProximity']) ?? null,
    listingIdHints: (raw.listingIdHints as string[]) ?? [],
    specialtyHints: (raw.specialtyHints as string[]) ?? [],
    confidence: (raw.confidence as number) ?? 1,
    missingFields: (raw.missingFields as string[]) ?? [],
    rawText: (raw.rawText as string) ?? null,
  };
}
