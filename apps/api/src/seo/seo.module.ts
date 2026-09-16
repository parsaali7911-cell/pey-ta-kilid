import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PublicSeoController } from './public-seo.controller';
import { SeoService } from './seo.service';

@Module({
  imports: [PrismaModule],
  controllers: [PublicSeoController],
  providers: [SeoService],
  exports: [SeoService],
})
export class SeoModule {}
