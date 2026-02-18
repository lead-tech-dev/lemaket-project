import { Column, Entity } from 'typeorm';
import { CoreEntity } from '../common/entities/base.entity';

@Entity({ name: 'admin_logs' })
export class AdminLog extends CoreEntity {
  @Column()
  action!: string;

  @Column({ type: 'text', nullable: true })
  details?: string;

  @Column({ nullable: true })
  actorName?: string;

  @Column({ nullable: true })
  actorRole?: string;

  @Column({ nullable: true })
  ipAddress?: string;
}
