import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum ExportFormat {
  CSV = 'csv',
  XLSX = 'xlsx'
}

export class ExportRequestDto {
  @IsEnum(ExportFormat)
  format!: ExportFormat;

  @IsOptional()
  @IsString()
  filter?: string;
}
