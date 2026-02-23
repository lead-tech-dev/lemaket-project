import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany
} from 'typeorm';
import { CoreEntity } from '../common/entities/base.entity';
import { ListingStatus } from '../common/enums/listing-status.enum';
import { Category } from '../categories/category.entity';
import { User } from '../users/user.entity';
import { ListingImage } from './listing-image.entity';
import { Promotion } from '../promotions/promotion.entity';
import { Favorite } from '../favorites/favorite.entity';
import { Report } from '../reports/report.entity';
import { Review } from '../reviews/review.entity';

export enum ListingFlow {
  SELL = 'SELL',
  BUY = 'BUY',
  LET = 'LET',
  RENT = 'RENT'
}

@Entity({ name: 'listings' })
@Index(['status', 'flow'])
@Index(['category'])
export class Listing extends CoreEntity {
  @Column()
  title!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  price!: number;

  @Column({ length: 10, default: 'XAF' })
  currency!: string;

  @Column({ type: 'jsonb', nullable: true })
  location?: {
    address?: string;
    city?: string;
    zipcode?: string;
    lat?: number;
    lng?: number;
    hideExact?: boolean;
  };

  @Column({ type: 'jsonb', nullable: true })
  contact?: {
    email?: string;
    phone?: string;
    phoneHidden?: boolean;
    noSalesmen?: boolean;
  };

  @Column({ default: false })
  isFeatured!: boolean;

  @Column({ default: false })
  isBoosted!: boolean;

  @Column({
    type: 'enum',
    enum: ListingStatus,
    default: ListingStatus.DRAFT
  })
  status!: ListingStatus;

  @Column({ type: 'jsonb', name: 'details', default: () => "'{}'" })
  formData!: Record<string, unknown>;

  @Column({ default: 0 })
  views!: number;

  @Column({ name: 'messages_count', default: 0 })
  messagesCount!: number;

  @Column({ type: 'timestamp', nullable: true })
  publishedAt?: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt?: Date | null;

  @ManyToOne(() => Category, category => category.listings, {
    eager: true,
    nullable: false
  })
  @JoinColumn({ name: 'category_id' })
  category!: Category;

  @Column({ type: 'enum', enum: ListingFlow, default: ListingFlow.SELL })
  flow!: ListingFlow;

  @ManyToOne(() => User, user => user.listings, {
    eager: true,
    nullable: false
  })
  @JoinColumn({ name: 'owner_id' })
  owner!: User;

  @OneToMany(() => ListingImage, image => image.listing, {
    cascade: true
  })
  images!: ListingImage[];

  @OneToMany(() => Promotion, promotion => promotion.listing)
  promotions!: Promotion[];

  @OneToMany(() => Favorite, favorite => favorite.listing)
  favorites!: Favorite[];

  @OneToMany(() => Report, report => report.listing)
  reports!: Report[];

  @OneToMany(() => Review, review => review.listing)
  reviews!: Review[];
}
