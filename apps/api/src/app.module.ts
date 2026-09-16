import './env';
import { Module } from '@nestjs/common';
import { AiModule } from './ai/ai.module';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { HealthController } from './health.controller';
import { IdentityModule } from './identity/identity.module';
import { IntentModule } from './intent/intent.module';
import { InventoryModule } from './inventory/inventory.module';
import { I18nModule } from './i18n/i18n.module';
import { GeoModule } from './geo/geo.module';
import { PricingModule } from './pricing/pricing.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { SearchModule } from './search/search.module';
import { RfqModule } from './rfq/rfq.module';
import { QuoteModule } from './quote/quote.module';
import { CommerceModule } from './commerce/commerce.module';
import { ErpModule } from './erp/erp.module';
import { SeoModule } from './seo/seo.module';
import { DesignerModule } from './designer/designer.module';
import { ProfessionalLeadsModule } from './professionals/professional-leads.module';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    AuthModule,
    IdentityModule,
    CatalogModule,
    PricingModule,
    InventoryModule,
    I18nModule,
    GeoModule,
    AiModule,
    IntentModule,
    SearchModule,
    DesignerModule,
    ProfessionalLeadsModule,
    RfqModule,
    QuoteModule,
    CommerceModule,
    ErpModule,
    SeoModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
