import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf
} from 'class-validator';
import { ReportStatus } from '../../common/enums/report-status.enum';

export class CreateReportDto {
  @ValidateIf(o => !o.reportedUserId)
  @IsUUID()
  @IsOptional()
  listingId?: string;

  @ValidateIf(o => !o.listingId)
  @IsUUID()
  @IsOptional()
  reportedUserId?: string;

  @IsString()
  @MaxLength(200)
  reason!: string;

  @IsOptional()
  @IsString()
  details?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  contactPhone?: string;

  @IsOptional()
  @IsEnum(ReportStatus)
  status?: ReportStatus;
}
