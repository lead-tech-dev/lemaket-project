import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export enum AuditScope {
  USERS = 'users',
  CATEGORIES = 'categories',
  REPORTS = 'reports',
  LOGS = 'logs',
  PROMOTIONS = 'promotions',
  LISTINGS = 'listings',
  COMPANY_VERIFICATIONS = 'company-verifications',
  COURIER_VERIFICATIONS = 'courier-verifications'
}

export class AuditQueryDto {
  @IsEnum(AuditScope)
  scope!: AuditScope;

  @IsOptional()
  @IsString()
  targetId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
