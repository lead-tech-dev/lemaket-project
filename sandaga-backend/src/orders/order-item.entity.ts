import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { CoreEntity } from '../common/entities/base.entity';
import { Order } from './order.entity';
import { Listing } from '../listings/listing.entity';

@Entity({ name: 'order_items' })
export class OrderItem extends CoreEntity {
  @Column({ name: 'order_id' })
  orderId!: string;

  @Column({ name: 'listing_id' })
  listingId!: string;

  @Column()
  title!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  unitPrice!: string;

  @Column({ type: 'int', default: 1 })
  quantity!: number;

  @Column({ length: 3, default: 'XAF' })
  currency!: string;

  @ManyToOne(() => Order, order => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: Order;

  @ManyToOne(() => Listing, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'listing_id' })
  listing!: Listing;
}
