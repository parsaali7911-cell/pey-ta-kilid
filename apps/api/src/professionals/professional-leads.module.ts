import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ProfessionalLeadsController } from './professional-leads.controller';
import { ProfessionalLeadsService } from './professional-leads.service';

@Module({
  imports: [PrismaModule],
  controllers: [ProfessionalLeadsController],
  providers: [ProfessionalLeadsService],
  exports: [ProfessionalLeadsService],
})
export class ProfessionalLeadsModule {}
