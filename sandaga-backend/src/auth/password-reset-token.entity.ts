import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { CoreEntity } from '../common/entities/base.entity';
import { User } from '../users/user.entity';

@Entity({ name: 'password_reset_tokens' })
export class PasswordResetToken extends CoreEntity {
  @Column()
  token!: string;

  @Column({ type: 'timestamp' })
  expiresAt!: Date;

  @Column({ default: false })
  used!: boolean;

  @ManyToOne(() => User, user => user.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
