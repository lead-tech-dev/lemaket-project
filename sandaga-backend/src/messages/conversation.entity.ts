import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany
} from 'typeorm';
import { CoreEntity } from '../common/entities/base.entity';
import { User } from '../users/user.entity';
import { Listing } from '../listings/listing.entity';
import { Message } from './message.entity';
import { MessageAttachment } from './message-attachment.entity';

@Entity({ name: 'conversations' })
export class Conversation extends CoreEntity {
  @Column({ name: 'listing_id' })
  listingId!: string;

  @Column({ name: 'buyer_id' })
  buyerId!: string;

  @Column({ name: 'seller_id' })
  sellerId!: string;

  @Column({ name: 'courier_id', nullable: true })
  courierId?: string | null;

  @Column({ type: 'timestamp', nullable: true })
  lastMessageAt?: Date;

  @Column({ nullable: true })
  lastMessagePreview?: string;

  @Column({ type: 'int', default: 0 })
  unreadCountBuyer!: number;

  @Column({ type: 'int', default: 0 })
  unreadCountSeller!: number;

  @Column({ type: 'int', default: 0 })
  unreadCountCourier!: number;

  @ManyToOne(() => Listing, listing => listing.id, {
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'listing_id' })
  listing!: Listing;

  @ManyToOne(() => User, user => user.conversationsAsBuyer, {
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'buyer_id' })
  buyer!: User;

  @ManyToOne(() => User, user => user.conversationsAsSeller, {
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'seller_id' })
  seller!: User;

  @ManyToOne(() => User, user => user.conversationsAsCourier, {
    onDelete: 'SET NULL'
  })
  @JoinColumn({ name: 'courier_id' })
  courier?: User | null;

  @OneToMany(() => Message, message => message.conversation)
  messages!: Message[];

  @OneToMany(() => MessageAttachment, attachment => attachment.conversation)
  attachments!: MessageAttachment[];
}
