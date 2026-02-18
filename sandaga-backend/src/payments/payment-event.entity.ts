import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { CoreEntity } from '../common/entities/base.entity';
import { Payment } from './payment.entity';

@Entity({ name: 'payment_events' })
export class PaymentEvent extends CoreEntity {
  @Column({ name: 'payment_id', nullable: true })
  paymentId?: string | null;

  @Column({ nullable: true })
  provider?: string | null;

  @Column()
  type!: string;

  @Column({ nullable: true })
  status?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  payload?: Record<string, unknown> | null;

  @ManyToOne(() => Payment, {
    onDelete: 'SET NULL'
  })
  @JoinColumn({ name: 'payment_id' })
  payment?: Payment | null;
}
