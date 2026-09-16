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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateQuoteDraftDto } from './dto/create-quote.dto';
import { QuoteService } from './quote.service';

type AuthUser = { userId: string };

@Controller()
@UseGuards(JwtAuthGuard)
export class QuoteController {
  constructor(private readonly quotes: QuoteService) {}

  @Get('seller/rfqs/eligible')
  listEligible(
    @Req() req: { user: AuthUser },
    @Query('organizationId') organizationId: string,
  ) {
    return this.quotes.listEligibleRfqs(req.user.userId, organizationId);
  }

  @Post('seller/quotes/draft')
  createDraft(@Req() req: { user: AuthUser }, @Body() dto: CreateQuoteDraftDto) {
    return this.quotes.createDraft(req.user.userId, dto);
  }

  @Post('seller/quotes/:id/submit')
  submit(@Req() req: { user: AuthUser }, @Param('id') id: string) {
    return this.quotes.submit(req.user.userId, id);
  }

  @Get('seller/quotes')
  listSeller(
    @Req() req: { user: AuthUser },
    @Query('organizationId') organizationId: string,
  ) {
    return this.quotes.listSellerQuotes(req.user.userId, organizationId);
  }

  @Get('seller/quotes/:id')
  getSeller(@Req() req: { user: AuthUser }, @Param('id') id: string) {
    return this.quotes.getSellerQuote(req.user.userId, id);
  }

  @Get('buyer/rfqs/:rfqId/quotes')
  listBuyerForRfq(@Req() req: { user: AuthUser }, @Param('rfqId') rfqId: string) {
    return this.quotes.listBuyerQuotesForRfq(req.user.userId, rfqId);
  }

  @Get('buyer/quotes/:id')
  getBuyer(@Req() req: { user: AuthUser }, @Param('id') id: string) {
    return this.quotes.getBuyerQuote(req.user.userId, id);
  }

  @Post('buyer/quotes/:id/accept')
  accept(@Req() req: { user: AuthUser }, @Param('id') id: string) {
    return this.quotes.accept(req.user.userId, id);
  }

  @Post('buyer/quotes/:id/reject')
  reject(@Req() req: { user: AuthUser }, @Param('id') id: string) {
    return this.quotes.reject(req.user.userId, id);
  }

  @Post('seller/quotes/:id/cancel')
  cancel(@Req() req: { user: AuthUser }, @Param('id') id: string) {
    return this.quotes.cancel(req.user.userId, id);
  }
}
