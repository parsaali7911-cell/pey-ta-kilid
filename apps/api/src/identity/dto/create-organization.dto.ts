import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class OrgLocationInputDto {
  @IsString()
  @MinLength(1)
  city!: string;

  @IsOptional()
  @IsString()
  province?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z]{2}$/)
  countryCode?: string;

  @IsOptional()
  @IsString()
  line1?: string;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;
}

export class CreateOrganizationDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @MinLength(2)
  @Matches(/^[a-z0-9-]+$/, { message: 'slug must be lowercase alphanumeric with hyphens' })
  slug!: string;

  @IsOptional()
  @IsBoolean()
  canSell?: boolean;

  @IsOptional()
  @IsBoolean()
  canBuy?: boolean;

  @IsOptional()
  @IsBoolean()
  isProfessional?: boolean;

  /** Trade specialty code (from building lexicon). */
  @IsOptional()
  @IsString()
  primarySpecialty?: string;

  /** Required for marketplace matching — stored as public facility + service area. */
  @IsOptional()
  @ValidateNested()
  @Type(() => OrgLocationInputDto)
  location?: OrgLocationInputDto;
}

export class UpdateOrganizationCapabilitiesDto {
  @IsOptional()
  @IsBoolean()
  canSell?: boolean;

  @IsOptional()
  @IsBoolean()
  canBuy?: boolean;

  @IsOptional()
  @IsBoolean()
  isProfessional?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  primarySpecialty?: string;
}
