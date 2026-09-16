import { IsOptional, IsString, MinLength } from 'class-validator';

export class HomepageNaturalLanguageRequestDto {
  @IsString()
  @MinLength(1)
  text!: string;

  @IsOptional()
  @IsString()
  locale?: string;

  @IsOptional()
  @IsString()
  market?: string;

  @IsOptional()
  @IsString()
  imageAssetId?: string | null;
}
