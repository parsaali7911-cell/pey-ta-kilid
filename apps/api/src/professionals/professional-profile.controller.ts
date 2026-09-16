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
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlatformAdminGuard } from '../common/platform-admin.guard';
import { ProfessionalProfileService } from './professional-profile.service';

class OnboardQuickDto {
  @IsString()
  @MinLength(2)
  displayName!: string;

  @IsString()
  specialty!: string;

  @IsString()
  @MinLength(2)
  city!: string;

  @IsString()
  mobilePhone!: string;

  @IsString()
  nationalId!: string;
}

class UpdateProfileDto {
  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(80)
  yearsExperience?: number | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  secondarySpecialties?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  projectTypes?: string[];

  @IsOptional()
  @IsNumber()
  serviceRadiusKm?: number | null;

  @IsOptional()
  @IsNumber()
  priceRangeMin?: number | null;

  @IsOptional()
  @IsNumber()
  priceRangeMax?: number | null;

  @IsOptional()
  @IsString()
  priceCurrency?: string | null;

  @IsOptional()
  @IsString()
  priceNote?: string | null;

  @IsOptional()
  @IsString()
  availabilityNote?: string | null;

  @IsOptional()
  @IsString()
  primarySpecialty?: string | null;

  @IsOptional()
  @IsString()
  city?: string | null;
}

class NationalIdDto {
  @IsString()
  nationalId!: string;
}

class MobileOtpRequestDto {
  @IsString()
  mobilePhone!: string;
}

class MobileOtpConfirmDto {
  @IsString()
  mobilePhone!: string;

  @IsString()
  @MinLength(4)
  code!: string;
}

class CreateReviewDto {
  @IsString()
  @MinLength(2)
  authorName!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @IsString()
  body?: string;
}

@Controller()
export class ProfessionalProfileController {
  constructor(private readonly profiles: ProfessionalProfileService) {}

  @Get('professionals/by-slug/:slug')
  getPublic(@Param('slug') slug: string, @Query('locale') locale?: string) {
    return this.profiles.getPublicBySlug(slug, locale || 'fa');
  }

  @UseGuards(JwtAuthGuard)
  @Post('professionals/onboard')
  onboard(@Req() req: { user: { userId: string } }, @Body() dto: OnboardQuickDto) {
    return this.profiles.onboardQuick(req.user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('seller/professional-profile')
  mine(
    @Req() req: { user: { userId: string } },
    @Query('organizationId') organizationId: string,
  ) {
    return this.profiles.getMine(req.user.userId, organizationId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('seller/professional-profile')
  update(
    @Req() req: { user: { userId: string } },
    @Query('organizationId') organizationId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.profiles.updateProfile(req.user.userId, organizationId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('seller/professional-profile/national-id')
  setNationalId(
    @Req() req: { user: { userId: string } },
    @Query('organizationId') organizationId: string,
    @Body() dto: NationalIdDto,
  ) {
    return this.profiles.setNationalId(req.user.userId, organizationId, dto.nationalId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('seller/professional-profile/mobile/request-otp')
  requestOtp(
    @Req() req: { user: { userId: string } },
    @Query('organizationId') organizationId: string,
    @Body() dto: MobileOtpRequestDto,
  ) {
    return this.profiles.requestMobileOtp(req.user.userId, organizationId, dto.mobilePhone);
  }

  @UseGuards(JwtAuthGuard)
  @Post('seller/professional-profile/mobile/confirm-otp')
  confirmOtp(
    @Req() req: { user: { userId: string } },
    @Query('organizationId') organizationId: string,
    @Body() dto: MobileOtpConfirmDto,
  ) {
    return this.profiles.confirmMobileOtp(
      req.user.userId,
      organizationId,
      dto.mobilePhone,
      dto.code,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('seller/professional-profile/avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  uploadAvatar(
    @Req() req: { user: { userId: string } },
    @Query('organizationId') organizationId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.profiles.uploadAvatar(req.user.userId, organizationId, file);
  }

  @UseGuards(JwtAuthGuard)
  @Post('seller/professional-profile/portfolio')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  addPortfolio(
    @Req() req: { user: { userId: string } },
    @Query('organizationId') organizationId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { caption?: string },
  ) {
    return this.profiles.addPortfolio(req.user.userId, organizationId, file, body?.caption);
  }

  @Post('professionals/:slugOrId/reviews')
  createReviewGuest(@Param('slugOrId') slugOrId: string, @Body() dto: CreateReviewDto) {
    return this.profiles.createReview({
      organizationIdOrSlug: slugOrId,
      authorName: dto.authorName,
      rating: dto.rating,
      body: dto.body,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post('professionals/:slugOrId/reviews/authenticated')
  createReviewAuthed(
    @Param('slugOrId') slugOrId: string,
    @Body() dto: CreateReviewDto,
    @Req() req: { user: { userId: string } },
  ) {
    return this.profiles.createReview({
      organizationIdOrSlug: slugOrId,
      authorUserId: req.user.userId,
      authorName: dto.authorName,
      rating: dto.rating,
      body: dto.body,
    });
  }

  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @Post('admin/professional-reviews/:publicId/approve')
  approveReview(@Param('publicId') publicId: string) {
    return this.profiles.approveReview(publicId);
  }
}
