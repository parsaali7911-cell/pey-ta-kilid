import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateFacilityDto, CreateServiceAreaDto, UpdateFacilityDto } from './dto/facility.dto';
import { FacilityService } from './facility.service';
import { GeoService } from './geo.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class FacilityController {
  constructor(
    private readonly facilities: FacilityService,
    private readonly geo: GeoService,
  ) {}

  @Post('seller/facilities')
  create(@Req() req: { user: { userId: string } }, @Body() dto: CreateFacilityDto) {
    return this.facilities.create(req.user.userId, dto);
  }

  @Get('seller/facilities')
  list(
    @Req() req: { user: { userId: string } },
    @Query('organizationId') organizationId: string,
  ) {
    return this.facilities.listForOrg(req.user.userId, organizationId);
  }

  @Get('seller/facilities/:id')
  getOne(@Req() req: { user: { userId: string } }, @Param('id') id: string) {
    return this.facilities.getForOrg(req.user.userId, id);
  }

  @Patch('seller/facilities/:id')
  update(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: UpdateFacilityDto,
  ) {
    return this.facilities.update(req.user.userId, id, dto);
  }

  @Post('seller/service-areas')
  createServiceArea(
    @Req() req: { user: { userId: string } },
    @Body() dto: CreateServiceAreaDto,
  ) {
    return this.facilities.createServiceArea(req.user.userId, dto);
  }

  @Get('seller/service-areas')
  listServiceAreas(
    @Req() req: { user: { userId: string } },
    @Query('organizationId') organizationId: string,
  ) {
    return this.facilities.listServiceAreas(req.user.userId, organizationId);
  }

  /** Provider-independent distance helper for future map/nearby features. */
  @Get('geo/distance')
  distance(
    @Query('fromLat') fromLat: string,
    @Query('fromLng') fromLng: string,
    @Query('toLat') toLat: string,
    @Query('toLng') toLng: string,
  ) {
    return {
      distanceKm: this.geo.distanceKm(
        { latitude: Number(fromLat), longitude: Number(fromLng) },
        { latitude: Number(toLat), longitude: Number(toLng) },
      ),
    };
  }
}
