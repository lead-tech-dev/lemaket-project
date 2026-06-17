import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { CoreEntity } from '../common/entities/base.entity';
import { PromotionType } from '../common/enums/promotion-type.enum';
import { PromotionStatus } from '../common/enums/promotion-status.enum';
import { Listing } from '../listings/listing.entity';

export type PromotionPaymentStatus = 'unpaid' | 'pending' | 'paid' | 'failed';

@Entity({ name: 'promotions' })
export class Promotion extends CoreEntity {
  @Column()
  name!: string;

  @Column({ type: 'enum', enum: PromotionType })
  type!: PromotionType;

  @Column({ type: 'enum', enum: PromotionStatus, default: PromotionStatus.DRAFT })
  status!: PromotionStatus;

  @Column({ type: 'timestamp' })
  startDate!: Date;

  @Column({ type: 'timestamp' })
  endDate!: Date;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  budget!: string;

  @Column({ nullable: true, type: 'text' })
  description?: string;

  @Column({ name: 'source_option_id', nullable: true })
  sourceOptionId?: string | null;

  @Column({
    name: 'payment_status',
    type: 'varchar',
    length: 32,
    default: 'unpaid'
  })
  paymentStatus!: PromotionPaymentStatus;

  @Column({ name: 'payment_id', nullable: true })
  paymentId?: string | null;

  @Column({ name: 'auto_bump_interval_hours', type: 'integer', nullable: true })
  autoBumpIntervalHours?: number | null;

  @Column({ name: 'next_auto_bump_at', type: 'timestamp', nullable: true })
  nextAutoBumpAt?: Date | null;

  @Column({ name: 'listing_id', nullable: true })
  listingId?: string | null;

  @ManyToOne(() => Listing, listing => listing.promotions, {
    onDelete: 'SET NULL'
  })
  @JoinColumn({ name: 'listing_id' })
  listing?: Listing | null;
}
