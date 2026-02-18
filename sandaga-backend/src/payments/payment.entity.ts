import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { CoreEntity } from '../common/entities/base.entity';
import { User } from '../users/user.entity';
import { PaymentMethodEntity } from './payment-method.entity';
import { PaymentStatus } from '../common/enums/payment-status.enum';

@Entity({ name: 'payments' })
export class Payment extends CoreEntity {
  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount!: string;

  @Column({ length: 3, default: 'EUR' })
  currency!: string;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  status!: PaymentStatus;

  @Column({ nullable: true })
  description?: string;

  @Column({ nullable: true })
  provider?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown> | null;

  @Column({ nullable: true })
  invoiceNumber?: string;

  @Column({ nullable: true })
  invoiceUrl?: string;

  @Column({ nullable: true })
  externalReference?: string;

  @Column({ name: 'user_id' })
  userId!: string;

  @Column({ name: 'payment_method_id', nullable: true })
  paymentMethodId?: string | null;

  @ManyToOne(() => User, user => user.payments, {
    onDelete: 'SET NULL'
  })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => PaymentMethodEntity, method => method.payments, {
    onDelete: 'SET NULL'
  })
  @JoinColumn({ name: 'payment_method_id' })
  paymentMethod?: PaymentMethodEntity | null;
}
