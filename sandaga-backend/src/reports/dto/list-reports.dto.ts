import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dtos/pagination-query.dto';
import { ReportStatus } from '../../common/enums/report-status.enum';

export class ListReportsDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ReportStatus)
  status?: ReportStatus;
}
