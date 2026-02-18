import { Column, Entity } from 'typeorm';
import { CoreEntity } from '../common/entities/base.entity';

@Entity({ name: 'message_notification_logs' })
export class MessageNotificationLog extends CoreEntity {
  @Column({ name: 'message_id', nullable: true })
  messageId?: string | null;

  @Column({ name: 'conversation_id', nullable: true })
  conversationId?: string | null;

  @Column({ name: 'recipient_id', nullable: true })
  recipientId?: string | null;

  @Column({ type: 'varchar', length: 20 })
  channel!: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  provider?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  destination?: string | null;

  @Column({ type: 'varchar', length: 20 })
  status!: string;

  @Column({ type: 'text', nullable: true })
  error?: string | null;
}
