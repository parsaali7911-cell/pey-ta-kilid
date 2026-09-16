import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrgAccessService } from '../common/org-access.service';
import { PlatformAdminGuard } from '../common/platform-admin.guard';
import { PrismaService } from '../prisma/prisma.service';
import {
  QuotePriceDto,
  SetListingPriceDto,
  UpdatePricingSettingsDto,
} from './dto/pricing-inventory.dto';
import { PricingService } from './pricing.service';

@Controller()
export class PricingController {
  constructor(
    private readonly pricing: PricingService,
    private readonly prisma: PrismaService,
    private readonly orgAccess: OrgAccessService,
  ) {}

  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @Get('admin/pricing/settings')
  getSettings() {
    return this.pricing.getSettings();
  }

  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @Patch('admin/pricing/settings')
  updateSettings(@Body() dto: UpdatePricingSettingsDto) {
    return this.pricing.updateSettings(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('pricing/quote')
  quote(@Body() dto: QuotePriceDto) {
    return this.pricing.quote(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('seller/listings/:id/price')
  async setPrice(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: SetListingPriceDto,
  ) {
    const listing = await this.prisma.listing.findUnique({ where: { id } });
    if (!listing) throw new NotFoundException('Listing not found');
    await this.orgAccess.requireSellerWriter(req.user.userId, listing.organizationId);
    const price = await this.pricing.setListingPrice(id, dto);
    return this.pricing.toSellerPriceDto(price);
  }

  @UseGuards(JwtAuthGuard)
  @Get('seller/listings/:id/price')
  async getSellerPrice(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
  ) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: { price: true },
    });
    if (!listing?.price) return null;
    await this.orgAccess.requireMember(req.user.userId, listing.organizationId);
    return this.pricing.toSellerPriceDto(listing.price);
  }
}
