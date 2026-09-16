import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlatformAdminGuard } from '../common/platform-admin.guard';
import { AiGatewayService } from './ai-gateway.service';
import { AiUsageService } from './ai-usage.service';
import { TranslationService } from './translation.service';

class TranslationFieldDto {
  @IsString()
  @MinLength(1)
  field!: string;

  @IsOptional()
  @IsString()
  sourceText?: string | null;
}

class TranslateContentDto {
  @IsString()
  entityType!: string;

  @IsString()
  entityId!: string;

  @IsString()
  @MinLength(2)
  sourceLocale!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetLocales?: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TranslationFieldDto)
  fields!: TranslationFieldDto[];
}

@Controller('ai')
export class AiGatewayController {
  constructor(
    private readonly ai: AiGatewayService,
    private readonly translation: TranslationService,
    private readonly usage: AiUsageService,
  ) {}

  @Get('status')
  status() {
    const provider = this.ai.getProviderName();
    return {
      provider,
      catalogAccess: this.ai.assertReadOnlyCatalogAccess(),
      translation: {
        locales: ['fa', 'en', 'ar'],
        fields: ['title', 'description', 'name', 'seoTitle', 'seoDescription'],
      },
      capabilities: {
        intentSearch: 'rule-based (always on)',
        visualSearch: provider === 'none' ? 'client-hex + soft text fallback' : 'vision + search',
        voiceTranscribe: provider === 'none' ? 'unavailable' : 'available',
        designerGenerate: provider === 'none' ? 'request-only (no image gen)' : 'available',
        contentTranslation: provider === 'none' ? 'queued / manual locales' : 'provider-backed',
      },
      note:
        provider === 'none'
          ? 'AI_PROVIDER=none — core marketplace works without LLM; set a provider for voice/vision/translation generation.'
          : 'AI Gateway — provider abstraction active',
    };
  }

  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @Post('complete/probe')
  probeComplete() {
    return this.ai.complete({ prompt: 'ping', maxOutputTokens: 8 });
  }

  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @Post('translations/run')
  runTranslation(@Body() dto: TranslateContentDto) {
    return this.translation.translateContent({
      entityType: dto.entityType,
      entityId: dto.entityId,
      sourceLocale: dto.sourceLocale,
      targetLocales: dto.targetLocales,
      fields: dto.fields.map((f) => ({
        field: f.field,
        sourceText: f.sourceText,
      })),
    });
  }

  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @Post('translations/schedule')
  scheduleTranslation(@Body() dto: TranslateContentDto) {
    return this.translation.scheduleAfterContentChange({
      entityType: dto.entityType,
      entityId: dto.entityId,
      sourceLocale: dto.sourceLocale,
      targetLocales: dto.targetLocales,
      fields: dto.fields.map((f) => ({
        field: f.field,
        sourceText: f.sourceText,
      })),
    });
  }

  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @Get('usage')
  usageSummary(@Query('operation') operation?: string) {
    return this.usage.summarize({ operation });
  }
}
