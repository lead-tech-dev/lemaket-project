import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { CoreEntity } from '../common/entities/base.entity';
import { PaymentMethodType } from '../common/enums/payment-method-type.enum';
import { PaymentMethodVerificationStatus } from '../common/enums/payment-method-verification-status.enum';
import { Subscription } from './subscription.entity';
import { User } from '../users/user.entity';
import { Payment } from './payment.entity';

@Entity({ name: 'payment_methods' })
export class PaymentMethodEntity extends CoreEntity {
  @Column({ type: 'enum', enum: PaymentMethodType })
  type!: PaymentMethodType;

  @Column({ nullable: true })
  brand?: string;

  @Column({ nullable: true })
  last4?: string;

  @Column({ nullable: true })
  expMonth?: number;

  @Column({ nullable: true })
  expYear?: number;

  @Column({ nullable: true })
  holderName?: string;

  @Column({ nullable: true })
  label?: string;

  @Column({ nullable: true })
  provider?: string;

  @Column({ nullable: true })
  externalId?: string;

  @Column({ default: false })
  isDefault!: boolean;

  @Column({ type: 'enum', enum: PaymentMethodVerificationStatus, default: PaymentMethodVerificationStatus.NOT_REQUIRED })
  verificationStatus!: PaymentMethodVerificationStatus;

  @Column({ type: 'timestamp', nullable: true })
  verifiedAt?: Date | null;

  @Column({ nullable: true })
  mandateReference?: string | null;

  @Column({ name: 'user_id' })
  userId!: string;

  @ManyToOne(() => User, user => user.paymentMethods, {
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @OneToMany(() => Payment, payment => payment.paymentMethod)
  payments!: Payment[];

  @OneToMany(() => Subscription, subscription => subscription.paymentMethod)
  subscriptions!: Subscription[];
}
