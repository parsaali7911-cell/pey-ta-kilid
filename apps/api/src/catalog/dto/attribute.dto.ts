import { AttributeDataType } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
  MinLength,
} from 'class-validator';

export class CreateAttributeDefinitionDto {
  @IsString()
  @MinLength(1)
  @Matches(/^[a-z0-9_]+$/)
  code!: string;

  @IsEnum(AttributeDataType)
  dataType!: AttributeDataType;

  @IsString()
  @MinLength(1)
  nameEn!: string;

  @IsOptional()
  @IsString()
  nameFa?: string;

  @IsOptional()
  @IsString()
  nameAr?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsBoolean()
  filterable?: boolean;

  @IsOptional()
  @IsBoolean()
  facetable?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  facetOrder?: number;

  @IsOptional()
  @IsArray()
  enumOptions?: string[];

  @IsOptional()
  @IsBoolean()
  inheritToChildren?: boolean;
}
