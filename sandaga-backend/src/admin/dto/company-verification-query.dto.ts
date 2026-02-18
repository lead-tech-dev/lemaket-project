import { IsEnum, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { CompanyVerificationStatus } from '../../users/enums/company-verification-status.enum';

export class CompanyVerificationQueryDto {
  @IsOptional()
  @IsEnum(CompanyVerificationStatus)
  status?: CompanyVerificationStatus;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  offset?: number;
}
