import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

class RfqItemInputDto {
  @IsOptional()
  @IsString()
  listingId?: string | null;

  @IsOptional()
  @IsString()
  productId?: string | null;

  @IsOptional()
  @IsString()
  variantId?: string | null;

  @IsOptional()
  @IsString()
  categoryId?: string | null;

  @IsNumber()
  @Min(0.0001)
  quantity!: number;

  @IsString()
  @MinLength(1)
  uomCode!: string;

  @IsOptional()
  @IsObject()
  attributeFilters?: Record<string, string | number | boolean | string[]> | null;

  @IsOptional()
  @IsString()
  titleSnapshot?: string | null;
}

export class CreateRfqDraftDto {
  @IsString()
  buyerOrganizationId!: string;

  @IsObject()
  requirements!: Record<string, unknown>;

  @IsArray()
  @IsString({ each: true })
  selectedListingIds!: string[];

  @IsOptional()
  @IsString()
  buyerNotes?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RfqItemInputDto)
  items?: RfqItemInputDto[];

  @IsOptional()
  @IsString()
  projectId?: string | null;

  @IsOptional()
  @IsString()
  projectRequirementId?: string | null;
}
