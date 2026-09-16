import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { FacilityController } from './facility.controller';
import { FacilityService } from './facility.service';
import { GeoService } from './geo.service';

@Module({
  imports: [CommonModule],
  controllers: [FacilityController],
  providers: [GeoService, FacilityService],
  exports: [GeoService, FacilityService],
})
export class GeoModule {}
