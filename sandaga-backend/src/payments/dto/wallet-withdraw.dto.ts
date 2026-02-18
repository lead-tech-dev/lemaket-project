import { IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class WalletWithdrawDto {
  @IsNumber()
  @Min(1)
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;
}
