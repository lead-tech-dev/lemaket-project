import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { CourierVerificationStatus } from '../../users/enums/courier-verification-status.enum';

export class CourierVerificationQueryDto {
  @IsOptional()
  @IsEnum(CourierVerificationStatus)
  status?: CourierVerificationStatus;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;
}
