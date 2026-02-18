import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { CoreEntity } from '../common/entities/base.entity';
import { User } from '../users/user.entity';

@Entity({ name: 'alerts' })
export class Alert extends CoreEntity {
  @Column({ name: 'user_id' })
  userId!: string;

  @ManyToOne(() => User, user => user.alerts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'varchar', length: 120, nullable: true })
  term?: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  location?: string | null;

  @Column({ name: 'category_slug', type: 'varchar', length: 140, nullable: true })
  categorySlug?: string | null;

  @Column({ name: 'seller_type', type: 'varchar', length: 20, nullable: true })
  sellerType?: string | null;

  @Column({ name: 'price_band', type: 'varchar', length: 20, nullable: true })
  priceBand?: string | null;

  @Column({ name: 'radius_km', type: 'int', nullable: true })
  radiusKm?: number | null;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;
}
