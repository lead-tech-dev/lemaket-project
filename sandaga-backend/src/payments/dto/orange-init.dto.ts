import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class OrangeInitDto {
  @IsNumber()
  @Min(100)
  amount!: number;

  @IsString()
  currency!: string; // XAF

  @IsString()
  description!: string;

  @IsOptional()
  @IsString()
  returnUrl?: string;

  @IsOptional()
  @IsString()
  cancelUrl?: string;
}
