import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne
} from 'typeorm';
import { CoreEntity } from '../common/entities/base.entity';
import { Listing } from '../listings/listing.entity';
import { User } from '../users/user.entity';
import { ReportStatus } from '../common/enums/report-status.enum';

@Entity({ name: 'reports' })
export class Report extends CoreEntity {
  @ManyToOne(() => Listing, listing => listing.reports, {
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'listing_id' })
  listing?: Listing | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'reported_user_id' })
  reportedUser?: User | null;

  @ManyToOne(() => User, user => user.reports, {
    onDelete: 'SET NULL',
    nullable: true
  })
  @JoinColumn({ name: 'reporter_id' })
  reporter?: User | null;

  @Column({ name: 'listing_id', nullable: true })
  listingId?: string | null;

  @Column({ name: 'reported_user_id', nullable: true })
  reportedUserId?: string | null;

  @Column({ name: 'reporter_id', nullable: true })
  reporterId?: string | null;

  @Column({ type: 'enum', enum: ReportStatus, default: ReportStatus.OPEN })
  status!: ReportStatus;

  @Column()
  reason!: string;

  @Column({ type: 'text', nullable: true })
  details?: string;

  @Column({ nullable: true })
  contactEmail?: string;

  @Column({ nullable: true })
  contactPhone?: string;

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt?: Date | null;

  @Column({ type: 'text', nullable: true })
  resolutionNotes?: string;
}
