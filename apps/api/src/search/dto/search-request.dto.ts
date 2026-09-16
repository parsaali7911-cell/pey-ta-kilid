import { Type } from 'class-transformer';
import {
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { RequestIntent } from '@peytakilid/shared-types';

class StructuredRequirementsDto {
  @IsString()
  intent!: RequestIntent | string;

  @IsOptional()
  @IsString()
  market?: string | null;

  @IsOptional()
  @IsString()
  locale?: string | null;

  @IsOptional()
  quantity?: number | null;

  @IsOptional()
  @IsString()
  uomCode?: string | null;

  @IsOptional()
  categoryHints?: string[];

  @IsOptional()
  @IsObject()
  attributeFilters?: Record<string, string | number | boolean | string[]>;

  @IsOptional()
  @IsObject()
  budget?: {
    min?: number | null;
    max?: number | null;
    currency?: string | null;
  } | null;

  @IsOptional()
  @IsObject()
  location?: Record<string, string | null> | null;

  @IsOptional()
  @IsObject()
  facilityProximity?: Record<string, unknown> | null;

  @IsOptional()
  listingIdHints?: string[];

  @IsOptional()
  specialtyHints?: string[];

  @IsOptional()
  confidence?: number;

  @IsOptional()
  missingFields?: string[];

  @IsOptional()
  @IsString()
  rawText?: string | null;
}

export class SearchRequestDto {
  @ValidateNested()
  @Type(() => StructuredRequirementsDto)
  requirements!: StructuredRequirementsDto;

  @IsOptional()
  @IsObject()
  filters?: Record<string, unknown>;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
