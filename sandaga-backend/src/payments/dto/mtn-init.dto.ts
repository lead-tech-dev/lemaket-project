import { IsNumber, IsString, Min } from 'class-validator';

export class MtnInitDto {
  @IsNumber()
  @Min(100)
  amount!: number;

  @IsString()
  currency!: string; // XAF

  @IsString()
  msisdn!: string; // format 2376xxxxxxx

  @IsString()
  description!: string;
}
