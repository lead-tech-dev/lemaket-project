import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { CoreEntity } from '../common/entities/base.entity';
import { Conversation } from './conversation.entity';
import { Message } from './message.entity';

@Entity({ name: 'message_attachments' })
export class MessageAttachment extends CoreEntity {
  @Column()
  url!: string;

  @Column({ name: 'file_name' })
  fileName!: string;

  @Column({ nullable: true })
  mimeType?: string | null;

  @Column({ type: 'int', nullable: true })
  size?: number | null;

  @Column({ name: 'message_id', nullable: true })
  messageId?: string | null;

  @Column({ name: 'conversation_id' })
  conversationId!: string;

  @ManyToOne(() => Message, message => message.attachments, {
    onDelete: 'SET NULL'
  })
  @JoinColumn({ name: 'message_id' })
  message?: Message | null;

  @ManyToOne(() => Conversation, conversation => conversation.attachments, {
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'conversation_id' })
  conversation!: Conversation;
}
