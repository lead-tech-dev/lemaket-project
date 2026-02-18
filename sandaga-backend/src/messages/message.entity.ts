import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { CoreEntity } from '../common/entities/base.entity';
import { Conversation } from './conversation.entity';
import { User } from '../users/user.entity';
import { MessageAttachment } from './message-attachment.entity';

@Entity({ name: 'messages' })
export class Message extends CoreEntity {
  @Column({ name: 'conversation_id' })
  conversationId!: string;

  @Column({ name: 'sender_id' })
  senderId!: string;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'timestamp', nullable: true })
  readAt?: Date | null;

  @Column({
    type: 'enum',
    enum: ['sent', 'delivered', 'read'],
    default: 'sent'
  })
  deliveryStatus!: 'sent' | 'delivered' | 'read';

  @Column({ type: 'timestamp', nullable: true })
  deliveredAt?: Date | null;

  @ManyToOne(() => Conversation, conversation => conversation.messages, {
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'conversation_id' })
  conversation!: Conversation;

  @ManyToOne(() => User, user => user.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sender_id' })
  sender!: User;

  @OneToMany(() => MessageAttachment, attachment => attachment.message)
  attachments!: MessageAttachment[];
}
