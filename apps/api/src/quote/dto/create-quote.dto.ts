import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

class QuoteItemInputDto {
  @IsOptional()
  @IsString()
  rfqItemId?: string | null;

  @IsOptional()
  @IsString()
  listingId?: string | null;

  @IsOptional()
  @IsString()
  productId?: string | null;

  @IsOptional()
  @IsString()
  variantId?: string | null;

  @IsNumber()
  @Min(0.0001)
  quantity!: number;

  @IsString()
  @MinLength(1)
  uomCode!: string;

  @IsNumber()
  @Min(0)
  basePrice!: number;

  @IsOptional()
  @IsNumber()
  leadTimeDays?: number | null;

  @IsOptional()
  @IsString()
  titleSnapshot?: string | null;
}

export class CreateQuoteDraftDto {
  @IsString()
  sellerOrganizationId!: string;

  @IsString()
  rfqId!: string;

  @IsOptional()
  @IsString()
  rfqTargetId?: string | null;

  @IsString()
  currency!: string;

  @IsString()
  priceType!: string;

  @IsOptional()
  @IsString()
  validUntil?: string | null;

  @IsOptional()
  @IsString()
  sellerNotes?: string | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuoteItemInputDto)
  items!: QuoteItemInputDto[];
}
