import { IsIn, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class WalletTopupDto {
  @IsNumber()
  @Min(1)
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @IsOptional()
  @IsString()
  @IsIn(['mobile_money', 'card'])
  paymentMethod?: 'mobile_money' | 'card';

  @IsOptional()
  @IsString()
  @IsIn(['mtn', 'orange'])
  paymentOperator?: 'mtn' | 'orange';

  @IsOptional()
  @IsString()
  @MaxLength(20)
  paymentPhone?: string;
}
