import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { IsArray, IsOptional, IsString, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlatformAdminGuard } from '../common/platform-admin.guard';
import { ProfessionalLeadsService } from './professional-leads.service';

class CreateLeadDto {
  @IsString()
  @MinLength(2)
  contactName!: string;

  @IsOptional()
  @IsString()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specialtyHints?: string[];

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  countryCode?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  sourceText?: string;

  @IsOptional()
  @IsString()
  locale?: string;
}

@Controller('professionals')
export class ProfessionalLeadsController {
  constructor(private readonly leads: ProfessionalLeadsService) {}

  @Get('directory')
  directory(
    @Query('locale') locale?: string,
    @Query('city') city?: string,
    @Query('province') province?: string,
    @Query('specialty') specialty?: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('radiusKm') radiusKm?: string,
    @Query('includeSellers') includeSellers?: string,
  ) {
    return this.leads.listProfessionalOrgs(locale, {
      city,
      province,
      specialty,
      lat: lat != null && lat !== '' ? Number(lat) : undefined,
      lng: lng != null && lng !== '' ? Number(lng) : undefined,
      radiusKm: radiusKm != null && radiusKm !== '' ? Number(radiusKm) : undefined,
      includeSellers: includeSellers === '1' || includeSellers === 'true',
    });
  }

  @Get('services')
  services() {
    return this.leads.listPublishedServiceListings();
  }

  @Post('leads')
  createLead(@Body() dto: CreateLeadDto) {
    return this.leads.create({
      contactName: dto.contactName,
      contactEmail: dto.contactEmail,
      contactPhone: dto.contactPhone,
      specialtyHints: dto.specialtyHints || [],
      city: dto.city,
      countryCode: dto.countryCode,
      notes: dto.notes,
      sourceText: dto.sourceText,
      locale: dto.locale || 'fa',
    });
  }

  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @Get('leads')
  listLeads() {
    return this.leads.list();
  }
}
