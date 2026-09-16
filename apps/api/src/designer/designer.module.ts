import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { PrismaModule } from '../prisma/prisma.module';
import { DesignerController } from './designer.controller';
import { DesignerService } from './designer.service';

@Module({
  imports: [PrismaModule, AiModule],
  controllers: [DesignerController],
  providers: [DesignerService],
  exports: [DesignerService],
})
export class DesignerModule {}
