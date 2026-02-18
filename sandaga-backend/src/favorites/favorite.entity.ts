import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { CoreEntity } from '../common/entities/base.entity';
import { User } from '../users/user.entity';
import { Listing } from '../listings/listing.entity';

@Entity({ name: 'favorites' })
@Unique(['userId', 'listingId'])
export class Favorite extends CoreEntity {
  @Column({ name: 'user_id' })
  userId!: string;

  @Column({ name: 'listing_id' })
  listingId!: string;

  @ManyToOne(() => User, user => user.favorites, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => Listing, listing => listing.favorites, {
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'listing_id' })
  listing!: Listing;
}
