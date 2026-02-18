import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { CoreEntity } from '../common/entities/base.entity';
import { User } from './user.entity';

@Entity({ name: 'user_follows' })
@Unique(['followerId', 'sellerId'])
export class UserFollow extends CoreEntity {
  @Column({ name: 'follower_id' })
  followerId!: string;

  @Column({ name: 'seller_id' })
  sellerId!: string;

  @ManyToOne(() => User, user => user.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'follower_id' })
  follower!: User;

  @ManyToOne(() => User, user => user.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'seller_id' })
  seller!: User;
}
