import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { CoreEntity } from '../common/entities/base.entity';
import { OrderStatus } from '../common/enums/order-status.enum';
import { Listing } from '../listings/listing.entity';
import { User } from '../users/user.entity';
import { Delivery } from '../deliveries/delivery.entity';
import { Payment } from '../payments/payment.entity';
import { OrderItem } from './order-item.entity';

@Entity({ name: 'orders' })
export class Order extends CoreEntity {
  @Column({ name: 'listing_id' })
  listingId!: string;

  @Column({ name: 'buyer_id' })
  buyerId!: string;

  @Column({ name: 'seller_id' })
  sellerId!: string;

  @Column({ name: 'delivery_id', nullable: true })
  deliveryId?: string | null;

  @Column({ name: 'payment_id', nullable: true })
  paymentId?: string | null;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING })
  status!: OrderStatus;

  @Column({ type: 'varchar', length: 12, default: 'delivery' })
  handoverMode!: 'delivery' | 'pickup';

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  listingAmount!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  deliveryAmount!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  platformFee!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  totalAmount!: string;

  @Column({ length: 3, default: 'XAF' })
  currency!: string;

  @Column({ type: 'timestamp', nullable: true })
  paidAt?: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  completedAt?: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  cancelledAt?: Date | null;

  @ManyToOne(() => Listing, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'listing_id' })
  listing!: Listing;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'buyer_id' })
  buyer!: User;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'seller_id' })
  seller!: User;

  @ManyToOne(() => Delivery, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'delivery_id' })
  delivery?: Delivery | null;

  @ManyToOne(() => Payment, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'payment_id' })
  payment?: Payment | null;

  @OneToMany(() => OrderItem, item => item.order, { cascade: true })
  items!: OrderItem[];
}
