import { Column, Entity, ManyToOne } from 'typeorm';
import { CoreEntity } from '../common/entities/base.entity';
import { User } from '../users/user.entity';
import { NotificationCategory } from './notification-category.enum';

@Entity({ name: 'notifications' })
export class Notification extends CoreEntity {
  @Column()
  userId!: string;

  @ManyToOne(() => User, user => user.notifications, { onDelete: 'CASCADE' })
  user!: User;

  @Column({
    type: 'enum',
    enum: NotificationCategory,
    default: NotificationCategory.SYSTEM
  })
  category!: NotificationCategory;

  @Column({ length: 160 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  body?: string | null;

  @Column({ default: false })
  isRead!: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;
}
