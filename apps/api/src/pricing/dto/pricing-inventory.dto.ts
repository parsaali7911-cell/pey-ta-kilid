import { CurrencyCode, PriceType, RoundingMode } from '@prisma/client';
import {
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';

export class SetListingPriceDto {
  @IsNumber()
  @Min(0)
  supplierCost!: number;

  @IsEnum(CurrencyCode)
  currency!: CurrencyCode;

  @IsEnum(PriceType)
  priceType!: PriceType;

  @IsOptional()
  @IsEnum(CurrencyCode)
  displayCurrency?: CurrencyCode;
}

export class QuotePriceDto {
  @IsNumber()
  @Min(0)
  supplierCost!: number;

  @IsEnum(CurrencyCode)
  currency!: CurrencyCode;

  @IsOptional()
  @IsEnum(CurrencyCode)
  displayCurrency?: CurrencyCode;
}

export class UpdatePricingSettingsDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  marginPercent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  flatFee?: number;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsEnum(CurrencyCode)
  flatFeeCurrency?: CurrencyCode | null;

  @IsOptional()
  @IsEnum(RoundingMode)
  roundingMode?: RoundingMode;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsNumber()
  @Min(0)
  roundingUnit?: number | null;

  @IsOptional()
  @IsObject()
  fxRates?: Record<string, number> | null;
}

export class InventoryQtyDto {
  @IsNumber()
  @Min(0.001)
  quantity!: number;

  @IsOptional()
  @IsString()
  note?: string;
}

export class InventoryAdjustDto {
  @IsNumber()
  quantityDelta!: number;

  @IsOptional()
  @IsString()
  note?: string;
}

export class ReserveDto {
  @IsNumber()
  @Min(0.001)
  quantity!: number;

  @IsOptional()
  @IsString()
  expiresAt?: string;
}
