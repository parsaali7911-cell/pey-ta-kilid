import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RfqController } from './rfq.controller';
import { RfqService } from './rfq.service';

@Module({
  imports: [PrismaModule, CommonModule],
  controllers: [RfqController],
  providers: [RfqService],
  exports: [RfqService],
})
export class RfqModule {}
