import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { CoreEntity } from '../common/entities/base.entity';
import { User } from '../users/user.entity';

@Entity({ name: 'quick_replies' })
export class QuickReply extends CoreEntity {
  @Column()
  label!: string;

  @Column({ type: 'text' })
  content!: string;

  @Column({ name: 'owner_id', nullable: true })
  ownerId?: string | null;

  @Column({ default: false })
  isGlobal!: boolean;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'owner_id' })
  owner?: User | null;
}
