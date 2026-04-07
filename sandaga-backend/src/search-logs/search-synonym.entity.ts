import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn
} from 'typeorm'

@Entity('search_synonyms')
@Unique('UQ_search_synonyms_normalized_pair', ['normalizedTerm', 'normalizedSynonym'])
export class SearchSynonym {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'varchar', length: 120 })
  term: string

  @Column({ type: 'varchar', length: 120 })
  synonym: string

  @Index('IDX_search_synonyms_normalized_term')
  @Column({ type: 'varchar', length: 120 })
  normalizedTerm: string

  @Index('IDX_search_synonyms_normalized_synonym')
  @Column({ type: 'varchar', length: 120 })
  normalizedSynonym: string

  @Column({ type: 'boolean', default: true })
  isActive: boolean

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date
}
