import { IsOptional, IsString, MaxLength } from 'class-validator';

export class DeactivateAccountDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
