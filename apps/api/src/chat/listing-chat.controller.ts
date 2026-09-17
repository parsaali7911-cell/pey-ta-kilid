import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { ListingChatService } from './listing-chat.service';

class StartChatDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  guestName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  guestPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  guestToken?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  locale?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}

class SendChatDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  guestToken?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  locale?: string;
}

@Controller('chat')
export class ListingChatController {
  constructor(private readonly chat: ListingChatService) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Post('listings/:slugOrId/threads')
  start(
    @Req() req: { user?: { userId: string } },
    @Param('slugOrId') slugOrId: string,
    @Body() dto: StartChatDto,
  ) {
    return this.chat.startOrGetThread({
      listingSlugOrId: slugOrId,
      userId: req.user?.userId,
      guestName: dto.guestName,
      guestPhone: dto.guestPhone,
      guestToken: dto.guestToken,
      locale: dto.locale,
      firstMessage: dto.message,
    });
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get('threads/:publicId')
  getThread(
    @Req() req: { user?: { userId: string } },
    @Param('publicId') publicId: string,
    @Query('guestToken') guestToken?: string,
  ) {
    return this.chat.getThreadPublic(publicId, {
      userId: req.user?.userId,
      guestToken,
    });
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Post('threads/:publicId/messages')
  sendBuyer(
    @Req() req: { user?: { userId: string } },
    @Param('publicId') publicId: string,
    @Body() dto: SendChatDto,
  ) {
    return this.chat.appendBuyerMessage({
      threadPublicId: publicId,
      userId: req.user?.userId,
      guestToken: dto.guestToken,
      body: dto.body,
      locale: dto.locale,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post('threads/:publicId/seller-messages')
  sendSeller(
    @Req() req: { user: { userId: string } },
    @Param('publicId') publicId: string,
    @Body() dto: SendChatDto,
  ) {
    return this.chat.appendSellerMessage({
      threadPublicId: publicId,
      userId: req.user.userId,
      body: dto.body,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('seller/threads')
  sellerInbox(
    @Req() req: { user: { userId: string } },
    @Query('organizationId') organizationId: string,
  ) {
    return this.chat.listSellerThreads(req.user.userId, organizationId);
  }
}
