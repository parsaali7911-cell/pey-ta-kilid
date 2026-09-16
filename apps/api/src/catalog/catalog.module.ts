import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { CommonModule } from '../common/common.module';
import { GeoModule } from '../geo/geo.module';
import { I18nModule } from '../i18n/i18n.module';
import { CategoryController } from './category.controller';
import { CategoryService } from './category.service';
import { ListingController } from './listing.controller';
import { ListingService } from './listing.service';
import { ProductMediaController } from './product-media.controller';
import { ProductMediaService } from './product-media.service';

@Module({
  imports: [CommonModule, I18nModule, GeoModule, AiModule],
  controllers: [CategoryController, ListingController, ProductMediaController],
  providers: [CategoryService, ListingService, ProductMediaService],
  exports: [CategoryService, ListingService, ProductMediaService],
})
export class CatalogModule {}
