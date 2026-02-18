import { Column, Entity } from 'typeorm';
import { CoreEntity } from '../common/entities/base.entity';

@Entity({ name: 'admin_settings' })
export class AdminSetting extends CoreEntity {
  @Column({ unique: true })
  key!: string;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  value!: Record<string, unknown>;
}
