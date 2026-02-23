import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne
} from 'typeorm';
import { CoreEntity } from '../common/entities/base.entity';
import { ReviewStatus } from '../common/enums/review-status.enum';
import { Listing } from '../listings/listing.entity';
import { User } from '../users/user.entity';

@Entity({ name: 'reviews' })
export class Review extends CoreEntity {
  @ManyToOne(() => Listing, listing => listing.reviews, {
    onDelete: 'CASCADE',
    nullable: true
  })
  @JoinColumn({ name: 'listing_id' })
  listing?: Listing | null;

  @ManyToOne(() => User, user => user.receivedReviews, {
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'seller_id' })
  seller!: User;

  @ManyToOne(() => User, user => user.givenReviews, {
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'reviewer_id' })
  reviewer!: User;

  @Column({ name: 'listing_id', nullable: true })
  listingId?: string | null;

  @Column({ name: 'seller_id' })
  sellerId!: string;

  @Column({ name: 'reviewer_id' })
  reviewerId!: string;

  @Column({ type: 'smallint' })
  rating!: number;

  @Column({ type: 'text' })
  comment!: string;

  @Column({ nullable: true })
  location?: string | null;

  @Column({ name: 'is_testimonial', default: false })
  isTestimonial!: boolean;

  @Column({
    type: 'enum',
    enum: ReviewStatus,
    default: ReviewStatus.APPROVED
  })
  status!: ReviewStatus;
}
