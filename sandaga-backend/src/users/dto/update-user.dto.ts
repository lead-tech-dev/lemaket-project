import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';
import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { CompanyVerificationStatus } from '../enums/company-verification-status.enum';
import { CourierVerificationStatus } from '../enums/courier-verification-status.enum';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;

  @IsOptional()
  @IsDateString()
  proExpiresAt?: string;

  @IsOptional()
  @IsEnum(CompanyVerificationStatus)
  companyVerificationStatus?: CompanyVerificationStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  companyVerificationReviewNotes?: string;

  @IsOptional()
  @IsEnum(CourierVerificationStatus)
  courierVerificationStatus?: CourierVerificationStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  courierVerificationReviewNotes?: string;
}
