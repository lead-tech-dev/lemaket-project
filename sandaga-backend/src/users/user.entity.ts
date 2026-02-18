import { Column, Entity, OneToMany } from 'typeorm';
import { CoreEntity } from '../common/entities/base.entity';
import { UserRole } from '../common/enums/user-role.enum';
import { Listing } from '../listings/listing.entity';
import { Favorite } from '../favorites/favorite.entity';
import { Conversation } from '../messages/conversation.entity';
import { Message } from '../messages/message.entity';
import { Payment } from '../payments/payment.entity';
import { PaymentMethodEntity } from '../payments/payment-method.entity';
import { Subscription } from '../payments/subscription.entity';
import { Report } from '../reports/report.entity';
import { Review } from '../reviews/review.entity';
import { IdentityVerificationStatus } from './enums/identity-verification-status.enum';
import { CompanyVerificationStatus } from './enums/company-verification-status.enum';
import { CourierVerificationStatus } from './enums/courier-verification-status.enum';
import { UserAddress } from './user-address.entity';
import { Notification } from '../notifications/notification.entity';
import { WalletTransaction } from '../payments/wallet-transaction.entity';
import { Alert } from '../alerts/alert.entity';
import { IdentityDocumentRecord } from './interfaces/identity-document.interface';

@Entity({ name: 'users' })
export class User extends CoreEntity {
  @Column({ unique: true })
  email!: string;

  @Column()
  firstName!: string;

  @Column()
  lastName!: string;

  @Column({ select: false })
  password!: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role!: UserRole;

  @Column({ nullable: true })
  phoneNumber?: string;

  @Column({ nullable: true })
  avatarUrl?: string;

  @Column({ nullable: true, type: 'text' })
  bio?: string;

  @Column({ nullable: true })
  location?: string;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  settings!: Record<string, unknown>;

  @Column({ name: 'wallet_balance', type: 'numeric', precision: 12, scale: 2, default: 0 })
  walletBalance!: string;

  @Column({ name: 'wallet_currency', length: 3, default: 'XAF' })
  walletCurrency!: string;

  @Column({
    type: 'enum',
    enum: IdentityVerificationStatus,
    default: IdentityVerificationStatus.UNVERIFIED
  })
  identityVerificationStatus!: IdentityVerificationStatus;

  @Column({ type: 'jsonb', nullable: true })
  identityDocuments?: IdentityDocumentRecord[] | null;

  @Column({ type: 'timestamp', nullable: true })
  identitySubmittedAt?: Date | null;

  @Column({ type: 'text', nullable: true })
  identityReviewNotes?: string | null;

  @Column({ default: false })
  isVerified!: boolean;

  @Column({ default: false })
  isPro!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  proActivatedAt?: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  proExpiresAt?: Date | null;

  @Column({ nullable: true })
  companyName?: string;

  @Column({ nullable: true })
  companyId?: string;

  @Column({ nullable: true })
  companyNiu?: string;

  @Column({ nullable: true })
  companyRccm?: string;

  @Column({ nullable: true })
  companyCity?: string;

  @Column({
    type: 'enum',
    enum: CompanyVerificationStatus,
    default: CompanyVerificationStatus.UNVERIFIED
  })
  companyVerificationStatus!: CompanyVerificationStatus;

  @Column({ nullable: true })
  companyVerificationDocumentUrl?: string;

  @Column({ type: 'timestamp', nullable: true })
  companyVerificationSubmittedAt?: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  companyVerificationReviewedAt?: Date | null;

  @Column({ type: 'text', nullable: true })
  companyVerificationReviewNotes?: string | null;

  @Column({
    type: 'enum',
    enum: CourierVerificationStatus,
    default: CourierVerificationStatus.UNVERIFIED
  })
  courierVerificationStatus!: CourierVerificationStatus;

  @Column({ nullable: true })
  courierVerificationDocumentUrl?: string;

  @Column({ type: 'timestamp', nullable: true })
  courierVerificationSubmittedAt?: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  courierVerificationReviewedAt?: Date | null;

  @Column({ type: 'text', nullable: true })
  courierVerificationReviewNotes?: string | null;

  @Column({ type: 'text', nullable: true })
  businessDescription?: string;

  @Column({ nullable: true })
  businessWebsite?: string;

  @Column({ nullable: true })
  storefrontSlug?: string;

  @Column({ nullable: true, type: 'text' })
  storefrontTagline?: string;

  @Column({ nullable: true })
  storefrontHeroUrl?: string;

  @Column({ nullable: true })
  storefrontTheme?: string;

  @Column({ default: true })
  storefrontShowReviews!: boolean;

  @Column({ default: true })
  isActive!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  lastLoginAt?: Date | null;

  @OneToMany(() => Listing, listing => listing.owner)
  listings!: Listing[];

  @OneToMany(() => Favorite, favorite => favorite.user)
  favorites!: Favorite[];

  @OneToMany(() => Conversation, conversation => conversation.buyer)
  conversationsAsBuyer!: Conversation[];

  @OneToMany(() => Conversation, conversation => conversation.seller)
  conversationsAsSeller!: Conversation[];

  @OneToMany(() => Conversation, conversation => conversation.courier)
  conversationsAsCourier!: Conversation[];

  @OneToMany(() => Message, message => message.sender)
  messages!: Message[];

  @OneToMany(() => Payment, payment => payment.user)
  payments!: Payment[];

  @OneToMany(() => Report, report => report.reporter)
  reports!: Report[];

  @OneToMany(() => Review, review => review.seller)
  receivedReviews!: Review[];

  @OneToMany(() => Review, review => review.reviewer)
  givenReviews!: Review[];

  @OneToMany(() => PaymentMethodEntity, method => method.user)
  paymentMethods!: PaymentMethodEntity[];

  @OneToMany(() => Subscription, subscription => subscription.user)
  subscriptions!: Subscription[];

  @OneToMany(() => UserAddress, address => address.user)
  addresses!: UserAddress[];

  @OneToMany(() => Notification, notification => notification.user)
  notifications!: Notification[];

  @OneToMany(() => WalletTransaction, tx => tx.user)
  walletTransactions!: WalletTransaction[];

  @OneToMany(() => Alert, alert => alert.user)
  alerts!: Alert[];
}
