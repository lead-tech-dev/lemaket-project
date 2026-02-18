import { Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min
} from 'class-validator';

export class CreateAlertDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  term?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(140)
  categorySlug?: string;

  @IsOptional()
  @IsIn(['pro', 'individual', 'all'])
  sellerType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  priceBand?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  radius?: number;
}
