import { IsIn, IsOptional, IsUUID } from 'class-validator';
import type { PromotionPaymentStatus } from '../promotion.entity';

const ALLOWED_PAYMENT_STATUSES: PromotionPaymentStatus[] = [
  'unpaid',
  'pending',
  'paid',
  'failed'
];

export class UpdatePromotionPaymentStatusDto {
  @IsIn(ALLOWED_PAYMENT_STATUSES)
  paymentStatus!: PromotionPaymentStatus;

  @IsOptional()
  @IsUUID()
  paymentId?: string;
}
