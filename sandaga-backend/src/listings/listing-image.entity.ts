import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { CoreEntity } from '../common/entities/base.entity';
import { Listing } from './listing.entity';

@Entity({ name: 'listing_images' })
export class ListingImage extends CoreEntity {
  @Column()
  url!: string;

  @Column({ type: 'int', default: 0 })
  position!: number;

  @Column({ default: false })
  isCover!: boolean;

  @Column({ name: 'listing_id' })
  listingId!: string;

  @ManyToOne(() => Listing, listing => listing.images, {
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'listing_id' })
  listing!: Listing;
}
