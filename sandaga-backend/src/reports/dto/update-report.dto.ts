import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ReportStatus } from '../../common/enums/report-status.enum';

export class UpdateReportDto {
  @IsOptional()
  @IsEnum(ReportStatus)
  status?: ReportStatus;

  @IsOptional()
  @IsString()
  resolutionNotes?: string;
}
