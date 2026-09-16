import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlatformAdminGuard } from '../common/platform-admin.guard';
import {
  CreateListingDto,
  RejectListingDto,
  UpdateListingDto,
} from './dto/listing.dto';
import { ListingService } from './listing.service';

@Controller()
export class ListingController {
  constructor(private readonly listings: ListingService) {}

  @Get('catalog/listings')
  listPublished(
    @Query('categoryId') categoryId?: string,
    @Query('locale') locale?: string,
  ) {
    return this.listings.listPublished(categoryId, locale);
  }

  @Get('catalog/listings/by-slug/:slug')
  bySlug(@Param('slug') slug: string, @Query('locale') locale?: string) {
    return this.listings.getPublishedBySlug(slug, locale);
  }

  @UseGuards(JwtAuthGuard)
  @Get('seller/listings')
  listMine(
    @Req() req: { user: { userId: string } },
    @Query('organizationId') organizationId: string,
  ) {
    return this.listings.listForOrg(req.user.userId, organizationId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('seller/listings')
  create(@Req() req: { user: { userId: string } }, @Body() dto: CreateListingDto) {
    return this.listings.create(req.user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('seller/listings/:id')
  update(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: UpdateListingDto,
  ) {
    return this.listings.update(req.user.userId, id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('seller/listings/:id/submit')
  submit(@Req() req: { user: { userId: string } }, @Param('id') id: string) {
    return this.listings.submit(req.user.userId, id);
  }

  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @Get('admin/listings/pending')
  pending() {
    return this.listings.listPendingReview();
  }

  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @Post('admin/listings/:id/approve')
  approve(@Req() req: { user: { userId: string } }, @Param('id') id: string) {
    return this.listings.approve(id, req.user.userId);
  }

  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @Post('admin/listings/:id/publish')
  publish(@Req() req: { user: { userId: string } }, @Param('id') id: string) {
    return this.listings.publish(id, req.user.userId);
  }

  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @Post('admin/listings/:id/reject')
  reject(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: RejectListingDto,
  ) {
    return this.listings.reject(id, dto.reason, req.user.userId);
  }
}
