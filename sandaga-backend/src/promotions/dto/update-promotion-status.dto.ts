import { IsEnum } from 'class-validator';
import { PromotionStatus } from '../../common/enums/promotion-status.enum';

export class UpdatePromotionStatusDto {
  @IsEnum(PromotionStatus)
  status!: PromotionStatus;
}
