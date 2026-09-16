import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { CommerceModule } from '../commerce/commerce.module';
import { PricingModule } from '../pricing/pricing.module';
import { PrismaModule } from '../prisma/prisma.module';
import { QuoteController } from './quote.controller';
import { QuoteService } from './quote.service';

@Module({
  imports: [PrismaModule, CommonModule, PricingModule, CommerceModule],
  controllers: [QuoteController],
  providers: [QuoteService],
  exports: [QuoteService],
})
export class QuoteModule {}
