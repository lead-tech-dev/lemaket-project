import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('search_logs')
@Index(['normalizedQuery'])
@Index(['createdAt'])
export class SearchLog {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'varchar', length: 160 })
  query: string

  @Column({ type: 'varchar', length: 160 })
  normalizedQuery: string

  @Column({ type: 'int', default: 0 })
  resultCount: number

  @Column({ type: 'varchar', length: 10, nullable: true })
  locale?: string | null

  @CreateDateColumn()
  createdAt: Date
}
