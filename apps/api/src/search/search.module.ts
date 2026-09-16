import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { I18nModule } from '../i18n/i18n.module';
import { IntentModule } from '../intent/intent.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { VisualVoiceSearchController } from './visual-voice.controller';
import { VisualVoiceSearchService } from './visual-voice.service';

@Module({
  imports: [PrismaModule, I18nModule, IntentModule, AiModule],
  controllers: [SearchController, VisualVoiceSearchController],
  providers: [SearchService, VisualVoiceSearchService],
  exports: [SearchService, VisualVoiceSearchService],
})
export class SearchModule {}
