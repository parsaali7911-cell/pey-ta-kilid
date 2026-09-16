import { Module } from '@nestjs/common';
import { I18nModule } from '../i18n/i18n.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PublicSeoController } from './public-seo.controller';
import { SeoContentService } from './seo-content.service';
import { SeoService } from './seo.service';

@Module({
  imports: [PrismaModule, I18nModule],
  controllers: [PublicSeoController],
  providers: [SeoService, SeoContentService],
  exports: [SeoService, SeoContentService],
})
export class SeoModule {}
