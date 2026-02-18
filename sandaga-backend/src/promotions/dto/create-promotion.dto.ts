import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min
} from 'class-validator';
import { PromotionType } from '../../common/enums/promotion-type.enum';
import { PromotionStatus } from '../../common/enums/promotion-status.enum';

export class CreatePromotionDto {
  @IsString()
  @MaxLength(190)
  name!: string;

  @IsEnum(PromotionType)
  type!: PromotionType;

  @IsEnum(PromotionStatus)
  status!: PromotionStatus;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsNumber()
  @Min(0)
  budget!: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  listingId?: string;
}
