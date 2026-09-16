import { FacilityStatus, FacilityType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
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

export class AddressInputDto {
  @IsString()
  @Matches(/^[A-Za-z]{2}$/)
  countryCode!: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsString()
  province?: string;

  @IsString()
  @MinLength(1)
  city!: string;

  @IsString()
  @MinLength(1)
  line1!: string;

  @IsOptional()
  @IsString()
  line2?: string;

  @IsOptional()
  @IsString()
  postalCode?: string;
}

export class GeoPointInputDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  accuracyM?: number;
}

export class CreateFacilityDto {
  @IsString()
  organizationId!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsEnum(FacilityType)
  type!: FacilityType;

  @IsOptional()
  @IsEnum(FacilityStatus)
  status?: FacilityStatus;

  @IsOptional()
  @IsBoolean()
  isPublicLocation?: boolean;

  @ValidateNested()
  @Type(() => AddressInputDto)
  address!: AddressInputDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => GeoPointInputDto)
  geoPoint?: GeoPointInputDto;
}

export class UpdateFacilityDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsEnum(FacilityType)
  type?: FacilityType;

  @IsOptional()
  @IsEnum(FacilityStatus)
  status?: FacilityStatus;

  @IsOptional()
  @IsBoolean()
  isPublicLocation?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => AddressInputDto)
  address?: AddressInputDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => GeoPointInputDto)
  geoPoint?: GeoPointInputDto | null;
}

export class CreateServiceAreaDto {
  @IsString()
  organizationId!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z]{2}$/)
  countryCode?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsString()
  province?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => GeoPointInputDto)
  centerPoint?: GeoPointInputDto;

  @IsOptional()
  @IsNumber()
  @Min(0)
  radiusKm?: number;
}
