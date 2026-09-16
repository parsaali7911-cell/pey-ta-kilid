import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProfessionalLeadsController } from './professional-leads.controller';
import { ProfessionalLeadsService } from './professional-leads.service';

@Module({
  imports: [PrismaModule, CommonModule],
  controllers: [ProfessionalLeadsController],
  providers: [ProfessionalLeadsService],
  exports: [ProfessionalLeadsService],
})
export class ProfessionalLeadsModule {}
