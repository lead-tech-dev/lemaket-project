import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { CoreEntity } from '../common/entities/base.entity';
import { User } from '../users/user.entity';
import { WalletTransactionType } from '../common/enums/wallet-transaction-type.enum';

@Entity({ name: 'wallet_transactions' })
export class WalletTransaction extends CoreEntity {
  @Column({ name: 'user_id' })
  userId!: string;

  @Column({ type: 'enum', enum: WalletTransactionType })
  type!: WalletTransactionType;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount!: string;

  @Column({ length: 3, default: 'XAF' })
  currency!: string;

  @Column({ length: 12, default: 'completed' })
  status!: 'completed' | 'pending' | 'failed';

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown> | null;

  @ManyToOne(() => User, user => user.walletTransactions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
