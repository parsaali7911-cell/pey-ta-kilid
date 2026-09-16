import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { LocalizedEntityType, MarketCode } from '@prisma/client';
import { IsEnum, IsString, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlatformAdminGuard } from '../common/platform-admin.guard';
import { LocalizationService } from './localization.service';
import { MarketService } from './market.service';

class UpsertTranslationDto {
  @IsEnum(LocalizedEntityType)
  entityType!: LocalizedEntityType;

  @IsString()
  entityId!: string;

  @IsString()
  @MinLength(2)
  localeCode!: string;

  @IsString()
  @MinLength(1)
  field!: string;

  @IsString()
  @MinLength(1)
  value!: string;
}

@Controller()
export class I18nController {
  constructor(
    private readonly localization: LocalizationService,
    private readonly markets: MarketService,
  ) {}

  @Get('i18n/locales')
  listLocales() {
    return this.localization.listLocales();
  }

  @Get('i18n/meta')
  async meta(
    @Query('locale') locale?: string,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    const requested = locale || acceptLanguage?.split(',')[0]?.trim()?.slice(0, 2);
    const resolved = await this.localization.resolveLocale(requested);
    return {
      locale: resolved,
      locales: await this.localization.listLocales(),
      markets: await this.markets.listMarkets(),
      commercial: this.markets.commercialFoundations(),
    };
  }

  @Get('markets')
  listMarkets() {
    return this.markets.listMarkets();
  }

  @Get('markets/:code')
  getMarket(@Param('code') code: string) {
    return this.markets.getMarket(code as MarketCode);
  }

  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @Post('admin/i18n/translations')
  upsertTranslation(@Body() dto: UpsertTranslationDto) {
    return this.localization.upsertContent(dto);
  }
}
