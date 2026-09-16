import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SeoModule } from '../seo/seo.module';
import { ProfessionalLeadsController } from './professional-leads.controller';
import { ProfessionalLeadsService } from './professional-leads.service';
import { ProfessionalProfileController } from './professional-profile.controller';
import { ProfessionalProfileService } from './professional-profile.service';

@Module({
  imports: [PrismaModule, CommonModule, SeoModule],
  controllers: [ProfessionalLeadsController, ProfessionalProfileController],
  providers: [ProfessionalLeadsService, ProfessionalProfileService],
  exports: [ProfessionalLeadsService, ProfessionalProfileService],
})
export class ProfessionalLeadsModule {}
