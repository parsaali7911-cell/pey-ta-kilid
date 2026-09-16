import { Module } from '@nestjs/common';
import { AiProvider } from '@peytakilid/shared-types';
import { CommonModule } from '../common/common.module';
import { appEnv } from '../env';
import { I18nModule } from '../i18n/i18n.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AiGatewayController } from './ai-gateway.controller';
import { AiGatewayService, NullAiProvider } from './ai-gateway.service';
import { AiUsageService } from './ai-usage.service';
import { OpenAiProvider } from './openai.provider';
import { TranslationService } from './translation.service';

export const AI_PROVIDER = Symbol('AI_PROVIDER');

@Module({
  imports: [PrismaModule, CommonModule, I18nModule],
  controllers: [AiGatewayController],
  providers: [
    {
      provide: AI_PROVIDER,
      useFactory: (): AiProvider => {
        if (appEnv.AI_PROVIDER === 'openai' && appEnv.OPENAI_API_KEY) {
          return new OpenAiProvider(appEnv.OPENAI_API_KEY, appEnv.OPENAI_MODEL);
        }
        void appEnv.AI_PROVIDER;
        return new NullAiProvider();
      },
    },
    {
      provide: AiGatewayService,
      useFactory: (provider: AiProvider) =>
        new AiGatewayService(provider, {
          maxCompleteOutputTokens: appEnv.AI_MAX_COMPLETE_TOKENS,
          maxEmbedTexts: appEnv.AI_MAX_EMBED_TEXTS,
          maxVisionOutputTokens: appEnv.AI_MAX_VISION_TOKENS,
        }),
      inject: [AI_PROVIDER],
    },
    AiUsageService,
    TranslationService,
  ],
  exports: [AiGatewayService, TranslationService, AiUsageService],
})
export class AiModule {}
