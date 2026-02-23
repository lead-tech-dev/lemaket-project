import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { CoreEntity } from '../common/entities/base.entity';
import { User } from '../users/user.entity';
import { PaymentMethodEntity } from './payment-method.entity';
import { SubscriptionStatus } from '../common/enums/subscription-status.enum';

@Entity({ name: 'subscriptions' })
export class Subscription extends CoreEntity {
  @Column({ name: 'user_id' })
  userId!: string;

  @Column({ name: 'payment_method_id', nullable: true })
  paymentMethodId?: string | null;

  @Column()
  planName!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount!: string;

  @Column({ length: 3, default: 'XAF' })
  currency!: string;

  @Column({ type: 'enum', enum: SubscriptionStatus, default: SubscriptionStatus.ACTIVE })
  status!: SubscriptionStatus;

  @Column({ default: true })
  autoRenew!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  nextRenewalAt?: Date | null;

  @Column({ nullable: true })
  description?: string | null;

  @Column({ nullable: true })
  externalId?: string | null;

  @ManyToOne(() => User, user => user.subscriptions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => PaymentMethodEntity, method => method.subscriptions, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'payment_method_id' })
  paymentMethod?: PaymentMethodEntity | null;
}
