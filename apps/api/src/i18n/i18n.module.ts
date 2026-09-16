import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { I18nController } from './i18n.controller';
import { LocalizationService } from './localization.service';
import { MarketService } from './market.service';

@Module({
  imports: [CommonModule],
  controllers: [I18nController],
  providers: [LocalizationService, MarketService],
  exports: [LocalizationService, MarketService],
})
export class I18nModule {}
