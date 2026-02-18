import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm'

@Entity('short_links')
@Unique(['slug'])
export class ShortLink {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'varchar', length: 32 })
  slug!: string

  @Column({ type: 'text' })
  targetUrl!: string

  @Column({ type: 'timestamp with time zone', nullable: true })
  expiresAt?: Date | null

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date
}
