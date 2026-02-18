import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { CoreEntity } from '../common/entities/base.entity';
import { PromotionType } from '../common/enums/promotion-type.enum';
import { PromotionStatus } from '../common/enums/promotion-status.enum';
import { Listing } from '../listings/listing.entity';

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

  @Column({ name: 'listing_id', nullable: true })
  listingId?: string | null;

  @ManyToOne(() => Listing, listing => listing.promotions, {
    onDelete: 'SET NULL'
  })
  @JoinColumn({ name: 'listing_id' })
  listing?: Listing | null;
}
