import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { memoryStorage } from 'multer';
import {
  ProjectRequirementKind,
  ProjectStageStatus,
  ProjectStatus,
} from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectService } from './project.service';

class CreateProjectDto {
  @IsString()
  ownerOrganizationId!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  ownerName?: string;

  @IsOptional()
  @IsString()
  projectTypeCode?: string;

  @IsOptional()
  @IsNumber()
  areaM2?: number;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  estimatedCompletionDate?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  countryCode?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsString()
  initialStageCode?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

class UpdateProjectDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  ownerName?: string | null;

  @IsOptional()
  @IsString()
  projectTypeCode?: string | null;

  @IsOptional()
  @IsNumber()
  areaM2?: number | null;

  @IsOptional()
  @IsString()
  startDate?: string | null;

  @IsOptional()
  @IsString()
  estimatedCompletionDate?: string | null;

  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @IsOptional()
  @IsString()
  notes?: string | null;

  @IsOptional()
  @IsString()
  city?: string | null;
}

class SetStageDto {
  @IsString()
  stageCode!: string;
}

class UpdateStageDto {
  @IsOptional()
  @IsEnum(ProjectStageStatus)
  status?: ProjectStageStatus;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  progressPct?: number;
}

class CreateRequirementDto {
  @IsString()
  @MinLength(2)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(ProjectRequirementKind)
  kind?: ProjectRequirementKind;

  @IsOptional()
  @IsString()
  stageCode?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  specialtyCode?: string;

  @IsOptional()
  @IsNumber()
  quantity?: number;

  @IsOptional()
  @IsString()
  uomCode?: string;

  @IsOptional()
  @IsString()
  needByDate?: string;

  @IsOptional()
  @IsString()
  procurementTargetDate?: string;
}

class LinkListingDto {
  @IsString()
  listingId!: string;
}

class LinkRfqDto {
  @IsString()
  rfqId!: string;
}

class LinkLeadDto {
  @IsString()
  leadId!: string;
}

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectController {
  constructor(private readonly projects: ProjectService) {}

  @Get('stage-catalog')
  catalog(@Query('locale') locale?: string) {
    return this.projects.stageCatalog(locale || 'fa');
  }

  @Get()
  list(@Req() req: { user: { userId: string } }, @Query('locale') locale?: string) {
    return this.projects.listForUser(req.user.userId, locale || 'fa');
  }

  @Post()
  create(
    @Req() req: { user: { userId: string } },
    @Body() dto: CreateProjectDto,
    @Query('locale') locale?: string,
  ) {
    return this.projects.create(req.user.userId, dto, locale || 'fa');
  }

  @Get(':id')
  getOne(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Query('locale') locale?: string,
  ) {
    return this.projects.getWorkspace(req.user.userId, id, locale || 'fa');
  }

  @Patch(':id')
  update(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
    @Query('locale') locale?: string,
  ) {
    return this.projects.updateProject(req.user.userId, id, dto, locale || 'fa');
  }

  @Post(':id/current-stage')
  setCurrent(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: SetStageDto,
    @Query('locale') locale?: string,
  ) {
    return this.projects.setCurrentStage(req.user.userId, id, dto.stageCode, locale || 'fa');
  }

  @Patch(':id/stages/:stageCode')
  updateStage(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Param('stageCode') stageCode: string,
    @Body() dto: UpdateStageDto,
    @Query('locale') locale?: string,
  ) {
    return this.projects.updateStage(req.user.userId, id, stageCode, dto, locale || 'fa');
  }

  @Post(':id/stages/:stageCode/seed-suggestions')
  seedSuggestions(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Param('stageCode') stageCode: string,
    @Query('locale') locale?: string,
  ) {
    return this.projects.seedStageSuggestions(req.user.userId, id, stageCode, locale || 'fa');
  }

  @Post(':id/requirements')
  addRequirement(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: CreateRequirementDto,
    @Query('locale') locale?: string,
  ) {
    return this.projects.addRequirement(req.user.userId, id, dto, locale || 'fa');
  }

  @Post(':id/requirements/:requirementId/link-listing')
  linkListing(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Param('requirementId') requirementId: string,
    @Body() dto: LinkListingDto,
    @Query('locale') locale?: string,
  ) {
    return this.projects.linkListing(
      req.user.userId,
      id,
      requirementId,
      dto.listingId,
      locale || 'fa',
    );
  }

  @Post(':id/requirements/:requirementId/link-rfq')
  linkRfq(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Param('requirementId') requirementId: string,
    @Body() dto: LinkRfqDto,
    @Query('locale') locale?: string,
  ) {
    return this.projects.linkRfq(req.user.userId, id, requirementId, dto.rfqId, locale || 'fa');
  }

  @Post(':id/requirements/:requirementId/link-lead')
  linkLead(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Param('requirementId') requirementId: string,
    @Body() dto: LinkLeadDto,
    @Query('locale') locale?: string,
  ) {
    return this.projects.linkProfessionalLead(
      req.user.userId,
      id,
      requirementId,
      dto.leadId,
      locale || 'fa',
    );
  }

  @Post(':id/sync-commerce')
  syncCommerce(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Query('locale') locale?: string,
  ) {
    return this.projects.syncCommerceLinks(req.user.userId, id, locale || 'fa');
  }

  @Post(':id/media')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  uploadMedia(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { altText?: string },
    @Query('locale') locale?: string,
  ) {
    return this.projects.uploadPhoto(
      req.user.userId,
      id,
      file,
      body?.altText,
      locale || 'fa',
    );
  }

  @Post(':id/analyze')
  analyze(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Query('locale') locale?: string,
    @Query('apply') apply?: string,
  ) {
    const shouldApply = apply !== '0' && apply !== 'false';
    return this.projects.analyze(req.user.userId, id, shouldApply, locale || 'fa');
  }
}
