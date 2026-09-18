import { IsEmail, IsOptional, IsString, Matches, MinLength, ValidateIf } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  /** Iranian national ID — 10 digits; stored hashed only. */
  @ValidateIf((_, v) => v != null && String(v).length > 0)
  @IsString()
  @Matches(/^\d{10}$/)
  nationalId?: string;
}
