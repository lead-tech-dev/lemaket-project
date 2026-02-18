import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { CoreEntity } from '../common/entities/base.entity';
import { User } from './user.entity';

@Entity({ name: 'user_addresses' })
@Index(['userId', 'label'], { unique: false })
export class UserAddress extends CoreEntity {
  @Column()
  userId!: string;

  @ManyToOne(() => User, user => user.addresses, { onDelete: 'CASCADE' })
  user!: User;

  @Column({ length: 80 })
  label!: string;

  @Column({ length: 160 })
  recipientName!: string;

  @Column({ length: 160 })
  line1!: string;

  @Column({ length: 160, nullable: true })
  line2?: string;

  @Column({ length: 120 })
  city!: string;

  @Column({ length: 120, nullable: true })
  state?: string;

  @Column({ length: 24 })
  postalCode!: string;

  @Column({ length: 80 })
  country!: string;

  @Column({ length: 30, nullable: true })
  phone?: string;

  @Column({ default: false })
  isDefaultShipping!: boolean;

  @Column({ default: false })
  isDefaultBilling!: boolean;
}
