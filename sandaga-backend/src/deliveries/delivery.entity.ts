import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { CoreEntity } from '../common/entities/base.entity';
import { DeliveryStatus } from '../common/enums/delivery-status.enum';
import { Listing } from '../listings/listing.entity';
import { User } from '../users/user.entity';

@Entity({ name: 'deliveries' })
export class Delivery extends CoreEntity {
  @Column({ name: 'listing_id' })
  listingId!: string;

  @Column({ name: 'buyer_id' })
  buyerId!: string;

  @Column({ name: 'seller_id' })
  sellerId!: string;

  @Column({ name: 'courier_id', nullable: true })
  courierId?: string | null;

  @Column({ name: 'preferred_courier_id', nullable: true })
  preferredCourierId?: string | null;

  @Column({ name: 'handover_mode', type: 'varchar', length: 12, default: 'delivery' })
  handoverMode!: 'delivery' | 'pickup';

  @Column({ type: 'enum', enum: DeliveryStatus, default: DeliveryStatus.REQUESTED })
  status!: DeliveryStatus;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  price?: string | null;

  @Column({ default: 'XAF' })
  currency!: string;

  @Column({ type: 'text', nullable: true })
  pickupAddress?: string | null;

  @Column({ type: 'text', nullable: true })
  dropoffAddress?: string | null;

  @Column({ type: 'text', nullable: true })
  dropoffNotes?: string | null;

  @Column({ name: 'pickup_code', length: 10, nullable: true })
  pickupCode?: string | null;

  @Column({ name: 'pickup_code_verified_at', type: 'timestamp', nullable: true })
  pickupCodeVerifiedAt?: Date | null;

  @Column({ name: 'delivery_code', length: 10, nullable: true })
  deliveryCode?: string | null;

  @Column({ name: 'delivery_code_verified_at', type: 'timestamp', nullable: true })
  deliveryCodeVerifiedAt?: Date | null;

  @Column({ name: 'escrow_payment_id', nullable: true })
  escrowPaymentId?: string | null;

  @Column({ type: 'varchar', length: 20, default: 'none' })
  escrowStatus!: 'none' | 'pending' | 'held' | 'released' | 'refunded';

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  escrowAmount?: string | null;

  @Column({ length: 3, default: 'XAF' })
  escrowCurrency!: string;

  @Column({ type: 'float', nullable: true })
  pickupLat?: number | null;

  @Column({ type: 'float', nullable: true })
  pickupLng?: number | null;

  @Column({ type: 'float', nullable: true })
  dropoffLat?: number | null;

  @Column({ type: 'float', nullable: true })
  dropoffLng?: number | null;

  @Column({ type: 'timestamp', nullable: true })
  acceptedAt?: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  pickedUpAt?: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  deliveredAt?: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  canceledAt?: Date | null;

  @Column({ type: 'text', nullable: true })
  cancelReason?: string | null;

  @ManyToOne(() => Listing, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'listing_id' })
  listing!: Listing;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'buyer_id' })
  buyer!: User;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'seller_id' })
  seller!: User;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'courier_id' })
  courier?: User | null;
}
