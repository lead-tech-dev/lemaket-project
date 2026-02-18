import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(255)
  password!: string;

  @IsString()
  @MaxLength(120)
  firstName!: string;

  @IsString()
  @MaxLength(120)
  lastName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phoneNumber?: string;

  @IsOptional()
  @IsBoolean()
  isPro?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  companyName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  companyId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  companyNiu?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  companyRccm?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  companyCity?: string;
}
